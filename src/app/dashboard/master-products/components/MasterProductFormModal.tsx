'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Spinner } from '@/presentation/components/Spinner';
import { resolveThumbUrl } from '@/infrastructure/utils/thumbUrl';
import type { MasterProductUseCase } from '@/application/usecases/MasterProductUseCase';
import type { GetProductsUseCase } from '@/application/usecases/GetProductsUseCase';
import type { CarrierRateUseCase } from '@/application/usecases/CarrierRateUseCase';
import type { PackageUseCase } from '@/application/usecases/PackageUseCase';
import type { ThumbnailTemplateUseCase } from '@/application/usecases/ThumbnailTemplateUseCase';
import type { DetailContentUseCase } from '@/application/usecases/DetailContentUseCase';
import type { MasterProductResponse } from '@/domain/entities/MasterProductEntity';
import type { Product } from '@/domain/entities/Product';
import type { CarrierRate } from '@/domain/entities/CarrierRateEntity';
import type { Package } from '@/domain/entities/PackageEntity';
import { BUILTIN_FIELD_KEYS, type TemplateField } from '@/domain/entities/ThumbnailEntity';
import { MasterOptionEditor } from './MasterOptionEditor';
import { MasterDetailImagesSection } from './MasterDetailImagesSection';

const formatWon = (v: number) => `${v.toLocaleString('ko-KR')}원`;

interface MasterProductFormModalProps {
  master: MasterProductResponse | null; // null = create mode
  useCase: MasterProductUseCase;
  productsUseCase: GetProductsUseCase;
  carrierRateUseCase: CarrierRateUseCase;
  packageUseCase: PackageUseCase;
  thumbnailTemplateUseCase: ThumbnailTemplateUseCase;
  detailUseCase: DetailContentUseCase;
  onClose: () => void;
  onDataChanged: () => Promise<void> | void; // reload parent list
}

/**
 * 판매상품 마스터 생성/수정 모달.
 * File: src/app/dashboard/master-products/components/MasterProductFormModal.tsx
 * 옵션 편집(MasterOptionEditor)은 수정 모드(=마스터 id 존재)에서만 노출.
 */
export function MasterProductFormModal({
  master: initialMaster,
  useCase,
  productsUseCase,
  carrierRateUseCase,
  packageUseCase,
  thumbnailTemplateUseCase,
  detailUseCase,
  onClose,
  onDataChanged,
}: MasterProductFormModalProps) {
  const [master, setMaster] = useState<MasterProductResponse | null>(initialMaster);
  const isEdit = master != null;

  const [name, setName] = useState(initialMaster?.name ?? '');
  const [selectedIds, setSelectedIds] = useState<number[]>(
    initialMaster?.components.map((c) => c.productId) ?? []
  );
  const [detailSource, setDetailSource] = useState(initialMaster?.detailSource ?? '');
  const [active, setActive] = useState(initialMaster?.active ?? true);
  const [imageFile, setImageFile] = useState<File | null>(null);

  // Default carrier/box for the price engine (options may override individually).
  const [defaultDeliveryId, setDefaultDeliveryId] = useState<number | ''>(
    initialMaster?.defaultDeliveryId ?? ''
  );
  const [defaultPackageId, setDefaultPackageId] = useState<number | ''>(
    initialMaster?.defaultPackageId ?? ''
  );

  // Create mode only: zone images buffered here (single source), uploaded after create().
  const [pendingZoneImages, setPendingZoneImages] = useState<Record<string, File[]>>({});

  const [fields, setFields] = useState<TemplateField[]>([]);
  const [fieldValues, setFieldValues] = useState<Record<string, string>>(
    initialMaster?.fieldValues ?? {}
  );

  const [products, setProducts] = useState<Product[]>([]);
  const [carrierRates, setCarrierRates] = useState<CarrierRate[]>([]);
  const [packages, setPackages] = useState<Package[]>([]);
  const [productFilter, setProductFilter] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [prod, rates, boxes] = await Promise.all([
          productsUseCase.getProducts({ page: 0, size: 1000 }),
          carrierRateUseCase.getCarrierRates(),
          packageUseCase.getPackages(),
        ]);
        if (!alive) return;
        setProducts(prod.content);
        setCarrierRates(rates);
        setPackages(boxes);
      } catch {
        if (alive) setError('구성상품·택배/박스 후보를 불러오지 못했습니다.');
      }
      // Template fields are a secondary input — a load failure must not block the form.
      try {
        const templates = await thumbnailTemplateUseCase.list();
        if (alive) setFields(templates.find((t) => t.isDefault)?.fields ?? []);
      } catch {
        if (alive) setFields([]);
      }
    })();
    return () => {
      alive = false;
    };
  }, [productsUseCase, carrierRateUseCase, packageUseCase, thumbnailTemplateUseCase]);

  const reloadMaster = useCallback(async () => {
    if (!master) return;
    const fresh = await useCase.getById(master.id);
    setMaster(fresh);
  }, [useCase, master]);

  const toggleProduct = (id: number) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const filteredProducts = useMemo(() => {
    const q = productFilter.trim().toLowerCase();
    if (!q) return products;
    return products.filter((p) => (p.productName ?? '').toLowerCase().includes(q));
  }, [products, productFilter]);

  const handleSubmit = async () => {
    setError('');
    if (!name.trim()) {
      setError('이름을 입력하세요.');
      return;
    }
    if (selectedIds.length === 0) {
      setError('구성상품을 1개 이상 선택하세요.');
      return;
    }
    setIsSubmitting(true);
    // Omit blank values so the backend falls back to product/template defaults.
    const cleaned: Record<string, string> = {};
    for (const [k, v] of Object.entries(fieldValues)) {
      if (v.trim() !== '') cleaned[k] = v;
    }
    try {
      if (!isEdit) {
        // Create the master first to obtain an id, then upload the image override.
        const created = await useCase.create({
          name: name.trim(),
          componentProductIds: selectedIds,
          detailSource: detailSource.trim() || undefined,
          fieldValues: Object.keys(cleaned).length ? cleaned : undefined,
          defaultDeliveryId: defaultDeliveryId === '' ? undefined : Number(defaultDeliveryId),
          defaultPackageId: defaultPackageId === '' ? undefined : Number(defaultPackageId),
        });
        if (imageFile) await useCase.uploadImage(created.id, imageFile);
        // Sequential await preserves selection order (backend sortOrder = upload order).
        // The master already exists; a zone upload failure surfaces a distinct banner.
        try {
          for (const [zoneId, files] of Object.entries(pendingZoneImages)) {
            for (const file of files) {
              await detailUseCase.uploadImage(created.id, file, zoneId);
            }
          }
        } catch {
          setError('상세 이미지 일부 업로드에 실패했습니다. 마스터는 생성되었습니다.');
          await onDataChanged();
          setIsSubmitting(false);
          return;
        }
        await onDataChanged();
        onClose();
      } else {
        await useCase.update(master!.id, {
          name: name.trim(),
          componentProductIds: selectedIds,
          detailSource: detailSource.trim(),
          active,
          // Always send the (possibly empty) map: backend treats non-null as a full
          // replace, so cleared fields are reflected; null would keep the old values.
          fieldValues: cleaned,
          defaultDeliveryId: defaultDeliveryId === '' ? undefined : Number(defaultDeliveryId),
          defaultPackageId: defaultPackageId === '' ? undefined : Number(defaultPackageId),
        });
        if (imageFile) await useCase.uploadImage(master!.id, imageFile);
        await onDataChanged();
        onClose();
      }
    } catch (e: unknown) {
      const status = (e as { response?: { status?: number } })?.response?.status;
      setError(status === 400 ? '입력값을 확인하세요.' : '저장에 실패했습니다.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const currentImageUrl = master?.sourceImageUrl ?? null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4">
      <div className="my-8 w-full max-w-2xl rounded-lg bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">
            {isEdit ? '마스터 수정' : '새 마스터'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
          >
            ✕
          </button>
        </div>

        {error && <p className="mb-4 rounded bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">이름 *</label>
            <input
              className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm text-gray-900"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">
              구성상품 세트 ({selectedIds.length}개 선택)
            </label>
            <input
              className="mb-2 w-full rounded border border-gray-300 px-2 py-1.5 text-sm text-gray-900"
              placeholder="상품명 검색"
              value={productFilter}
              onChange={(e) => setProductFilter(e.target.value)}
            />
            <div className="max-h-48 overflow-y-auto rounded border border-gray-200">
              {filteredProducts.length === 0 ? (
                <p className="px-3 py-2 text-sm text-gray-500">상품이 없습니다.</p>
              ) : (
                filteredProducts.map((p) => (
                  <label
                    key={p.id}
                    className="flex cursor-pointer items-center gap-2 border-b border-gray-100 px-3 py-1.5 text-sm text-gray-900 last:border-0 hover:bg-gray-50"
                  >
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(p.id)}
                      onChange={() => toggleProduct(p.id)}
                    />
                    <span>{p.productName}</span>
                  </label>
                ))
              )}
            </div>
          </div>

          {fields.length > 0 && (
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">
                템플릿 필드값 (선택)
              </label>
              <div className="grid grid-cols-2 gap-3">
                {fields.map((f) => (
                  <div key={f.key}>
                    <label className="mb-1 block text-xs font-medium text-gray-600">{f.label}</label>
                    <input
                      className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm text-gray-900"
                      value={fieldValues[f.key] ?? ''}
                      placeholder={
                        (BUILTIN_FIELD_KEYS as readonly string[]).includes(f.key)
                          ? '등록상품값 사용'
                          : '템플릿 기본값 사용'
                      }
                      onChange={(e) =>
                        setFieldValues((prev) => ({ ...prev, [f.key]: e.target.value }))
                      }
                    />
                  </div>
                ))}
              </div>
              <p className="mt-1 text-[11px] text-gray-500">
                비우면 예약 필드는 등록상품 정보, 커스텀 필드는 템플릿 기본값으로 채워집니다. 채널마다
                다르게 하려면 등록 후 셀의 [필드값 편집]에서 조정하세요.
              </p>
            </div>
          )}

          <MasterDetailImagesSection
            masterId={master?.id ?? null}
            detailUseCase={detailUseCase}
            pendingByZone={pendingZoneImages}
            onPendingChange={(zoneId, files) =>
              setPendingZoneImages((prev) => ({ ...prev, [zoneId]: files }))
            }
          />

          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">상세 설명 (detailSource)</label>
            <textarea
              className="h-24 w-full rounded border border-gray-300 px-2 py-1.5 text-sm text-gray-900"
              value={detailSource}
              onChange={(e) => setDetailSource(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">기본 택배비</label>
              <select
                className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm text-gray-900"
                value={defaultDeliveryId}
                onChange={(e) => setDefaultDeliveryId(e.target.value ? Number(e.target.value) : '')}
              >
                <option value="">선택 안 함</option>
                {carrierRates.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.carrier} {r.type} · {formatWon(r.cost)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">기본 상자비</label>
              <select
                className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm text-gray-900"
                value={defaultPackageId}
                onChange={(e) => setDefaultPackageId(e.target.value ? Number(e.target.value) : '')}
              >
                <option value="">선택 안 함</option>
                {packages.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.type} · {formatWon(p.cost)}
                  </option>
                ))}
              </select>
            </div>
            <p className="col-span-2 text-[11px] text-gray-500">
              옵션에서 개별 지정하지 않으면 이 값이 모든 옵션 판매가 계산에 쓰입니다.
            </p>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">대표사진 override</label>
            <div className="flex items-center gap-3">
              <div className="h-16 w-16 overflow-hidden rounded bg-gray-100">
                {imageFile ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={URL.createObjectURL(imageFile)}
                    alt="preview"
                    className="h-full w-full object-contain"
                  />
                ) : currentImageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={resolveThumbUrl(currentImageUrl)}
                    alt="current"
                    className="h-full w-full object-contain"
                  />
                ) : (
                  <span className="flex h-full w-full items-center justify-center text-[10px] text-gray-400">
                    없음
                  </span>
                )}
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png"
                onChange={(e) => setImageFile(e.target.files?.[0] ?? null)}
                className="text-sm text-gray-700"
              />
            </div>
          </div>

          {isEdit && (
            <label className="flex items-center gap-2 text-sm text-gray-900">
              <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
              활성 (active)
            </label>
          )}
        </div>

        <div className="mt-6 flex gap-2">
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {isSubmitting ? <Spinner label="저장 중..." /> : '저장'}
          </button>
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 disabled:opacity-50"
          >
            닫기
          </button>
        </div>

        {isEdit && master && (
          <div className="mt-6 border-t border-gray-200 pt-6">
            <MasterOptionEditor
              master={master}
              useCase={useCase}
              carrierRates={carrierRates}
              packages={packages}
              onChanged={async () => {
                await reloadMaster();
                await onDataChanged();
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
}
