'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Spinner } from '@/presentation/components/Spinner';
import { ProductThumbnailUseCase } from '@/application/usecases/ProductThumbnailUseCase';
import { ProductThumbnailRepositoryImpl } from '@/infrastructure/repositories/ProductThumbnailRepositoryImpl';
import { ThumbnailTemplateUseCase } from '@/application/usecases/ThumbnailTemplateUseCase';
import { ThumbnailTemplateRepositoryImpl } from '@/infrastructure/repositories/ThumbnailTemplateRepositoryImpl';
import { SellerRepositoryImpl } from '@/infrastructure/repositories/SellerRepositoryImpl';
import { useAuthStore } from '@/infrastructure/stores/authStore';
import { resolveThumbUrl } from '@/infrastructure/utils/thumbUrl';
import type { ProductThumbnail, TemplateField } from '@/domain/entities/ThumbnailEntity';
import type { Seller } from '@/domain/entities/SellerEntity';

/**
 * Per-seller thumbnail management on the product detail page.
 * File: src/app/dashboard/products/[id]/components/ProductThumbnailSection.tsx
 *
 * Server render (generate) can take a few seconds → per-card spinner + disabled.
 * After regenerate/override we reload listByProduct and cache-bust the <img>.
 */
interface ProductThumbnailSectionProps {
  productId: number;
  // Prefill sources for reserved fields (from the already-loaded parent product).
  productBrand?: string;
  productName?: string;
}

export function ProductThumbnailSection({ productId, productBrand, productName }: ProductThumbnailSectionProps) {
  const user = useAuthStore((state) => state.user);
  const isAdmin = user?.role === 'ADMIN';

  const useCase = useMemo(() => new ProductThumbnailUseCase(new ProductThumbnailRepositoryImpl()), []);
  const templateUseCase = useMemo(() => new ThumbnailTemplateUseCase(new ThumbnailTemplateRepositoryImpl()), []);
  const sellerRepository = useMemo(() => new SellerRepositoryImpl(), []);

  const [thumbnails, setThumbnails] = useState<ProductThumbnail[]>([]);
  const [sellers, setSellers] = useState<Seller[]>([]);
  const [templateFields, setTemplateFields] = useState<TemplateField[]>([]);
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({});
  const [selectedSellerId, setSelectedSellerId] = useState<number | ''>('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [busySellerId, setBusySellerId] = useState<number | null>(null);
  const [cacheBust, setCacheBust] = useState<Record<number, number>>({});

  const overrideInputRef = useRef<HTMLInputElement>(null);
  const overrideSellerRef = useRef<number | null>(null);

  const loadThumbnails = useCallback(async () => {
    const list = await useCase.listByProduct(productId);
    setThumbnails(list);
  }, [useCase, productId]);

  useEffect(() => {
    if (!isAdmin) return;
    let alive = true;
    (async () => {
      setIsLoading(true);
      setError('');
      try {
        const [list, sellerList] = await Promise.all([useCase.listByProduct(productId), sellerRepository.getAll()]);
        if (!alive) return;
        setThumbnails(list);
        setSellers(sellerList);
      } catch {
        if (alive) setError('썸네일 정보를 불러오지 못했습니다.');
      } finally {
        if (alive) setIsLoading(false);
      }
      // Default-template fields drive the field-value panel. Non-fatal: on failure
      // or legacy fields=null the panel stays empty and the backend uses defaults.
      try {
        const templates = await templateUseCase.list();
        if (!alive) return;
        const tf = templates.find((t) => t.isDefault)?.fields ?? [];
        setTemplateFields(tf);
        const initial: Record<string, string> = {};
        for (const f of tf) {
          if (f.key === 'brandName') initial[f.key] = productBrand ?? '';
          else if (f.key === 'productName') initial[f.key] = productName ?? '';
          else initial[f.key] = f.defaultValue;
        }
        setFieldValues(initial);
      } catch {
        // Leave the panel empty.
      }
    })();
    return () => {
      alive = false;
    };
  }, [useCase, templateUseCase, sellerRepository, productId, isAdmin, productBrand, productName]);

  const bust = (sellerId: number) => setCacheBust((prev) => ({ ...prev, [sellerId]: Date.now() }));

  const handleGenerate = async (sellerId: number) => {
    setError('');
    setBusySellerId(sellerId);
    if (selectedSellerId === sellerId || selectedSellerId === '') setIsGenerating(true);
    try {
      await useCase.generate(productId, sellerId, fieldValues);
      await loadThumbnails();
      bust(sellerId);
    } catch {
      setError('썸네일 생성에 실패했습니다. (템플릿/상품 이미지 확인)');
    } finally {
      setBusySellerId(null);
      setIsGenerating(false);
    }
  };

  const handleTopGenerate = async () => {
    if (selectedSellerId === '') {
      setError('판매자를 선택하세요.');
      return;
    }
    await handleGenerate(selectedSellerId);
  };

  const handleOverrideClick = (sellerId: number) => {
    overrideSellerRef.current = sellerId;
    overrideInputRef.current?.click();
  };

  const handleOverrideFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    const sellerId = overrideSellerRef.current;
    e.target.value = '';
    if (!file || sellerId == null) return;
    setError('');
    setBusySellerId(sellerId);
    try {
      await useCase.override(productId, sellerId, file);
      await loadThumbnails();
      bust(sellerId);
    } catch {
      setError('이미지 업로드(오버라이드)에 실패했습니다.');
    } finally {
      setBusySellerId(null);
    }
  };

  const handleDelete = async (sellerId: number) => {
    if (!confirm('이 판매자의 썸네일을 삭제하시겠습니까?')) return;
    setError('');
    setBusySellerId(sellerId);
    try {
      await useCase.remove(productId, sellerId);
      await loadThumbnails();
    } catch {
      setError('삭제에 실패했습니다.');
    } finally {
      setBusySellerId(null);
    }
  };

  const btnCls = 'rounded border px-2 py-1 text-xs font-medium disabled:opacity-50';

  if (!isAdmin) return null;

  return (
    <div className="border border-gray-200 rounded-lg p-6 bg-white">
      <h2 className="mb-4 text-lg font-semibold text-gray-900">판매자별 썸네일</h2>

      {/* Generate for a chosen seller */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <select
          className="rounded border border-gray-300 px-2 py-1.5 text-sm text-gray-900"
          value={selectedSellerId}
          onChange={(e) => setSelectedSellerId(e.target.value ? Number(e.target.value) : '')}
        >
          <option value="">판매자 선택</option>
          {sellers.map((s) => (
            <option key={s.id} value={s.id}>
              {s.sellerName}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={handleTopGenerate}
          disabled={isGenerating || selectedSellerId === ''}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {isGenerating ? <Spinner label="생성 중..." /> : '생성 / 재생성'}
        </button>
      </div>

      {/* Field values applied to generate/regenerate (reserved keys prefilled from product). */}
      {templateFields.length > 0 && (
        <div className="mb-4 grid grid-cols-1 gap-3 rounded-lg border border-gray-200 bg-gray-50 p-3 sm:grid-cols-2 lg:grid-cols-3">
          {templateFields.map((f) => {
            const reserved = f.key === 'brandName' || f.key === 'productName';
            return (
              <div key={f.key}>
                <label className="mb-1 block text-xs font-medium text-gray-600">
                  {f.label}
                  {reserved ? ' (자동)' : ''}
                </label>
                <input
                  className="w-full rounded border border-gray-300 px-2 py-1 text-sm text-gray-900"
                  value={fieldValues[f.key] ?? ''}
                  onChange={(e) => setFieldValues((prev) => ({ ...prev, [f.key]: e.target.value }))}
                />
              </div>
            );
          })}
        </div>
      )}

      {error && <p className="mb-4 rounded bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      {isLoading ? (
        <div className="flex min-h-32 items-center justify-center">
          <Spinner size={24} label="불러오는 중..." />
        </div>
      ) : thumbnails.length === 0 ? (
        <p className="text-sm text-gray-500">생성된 썸네일이 없습니다. 판매자를 선택해 생성하세요.</p>
      ) : (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
          {thumbnails.map((t) => {
            const busy = busySellerId === t.sellerId;
            return (
              <div key={t.sellerId} className="rounded-lg border border-gray-200 p-3">
                <div className="relative mb-2 aspect-square overflow-hidden rounded bg-gray-100">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={resolveThumbUrl(t.imageUrl, cacheBust[t.sellerId])}
                    alt={t.sellerName}
                    className="h-full w-full object-contain"
                  />
                  {busy && (
                    <div className="absolute inset-0 flex items-center justify-center bg-white/60">
                      <Spinner size={24} />
                    </div>
                  )}
                </div>
                <div className="mb-2 flex items-center justify-between gap-2">
                  <span className="truncate text-sm font-medium text-gray-900">{t.sellerName}</span>
                  <span
                    className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] ${
                      t.source === 'MANUAL_OVERRIDE'
                        ? 'bg-amber-100 text-amber-700'
                        : 'bg-blue-100 text-blue-700'
                    }`}
                  >
                    {t.source === 'MANUAL_OVERRIDE' ? 'MANUAL' : 'GENERATED'}
                  </span>
                </div>
                <div className="flex flex-wrap gap-1">
                  <button
                    type="button"
                    onClick={() => handleGenerate(t.sellerId)}
                    disabled={busy}
                    className={`${btnCls} border-blue-300 text-blue-600 hover:bg-blue-50`}
                  >
                    재생성
                  </button>
                  <button
                    type="button"
                    onClick={() => handleOverrideClick(t.sellerId)}
                    disabled={busy}
                    className={`${btnCls} border-gray-300 text-gray-700 hover:bg-gray-100`}
                  >
                    업로드
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(t.sellerId)}
                    disabled={busy}
                    className={`${btnCls} border-red-300 text-red-600 hover:bg-red-50`}
                  >
                    삭제
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <input
        ref={overrideInputRef}
        type="file"
        accept="image/jpeg,image/png"
        onChange={handleOverrideFile}
        hidden
      />
    </div>
  );
}
