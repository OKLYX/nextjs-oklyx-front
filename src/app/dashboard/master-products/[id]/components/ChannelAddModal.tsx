'use client';

import { useEffect, useMemo, useState } from 'react';
import { Spinner } from '@/presentation/components/Spinner';
import { resolveThumbUrl } from '@/infrastructure/utils/thumbUrl';
import { PLATFORMS } from '@/app/dashboard/sales-products/register/components/ProductListingForm';
import { ListingRegistrationUseCase } from '@/application/usecases/ListingRegistrationUseCase';
import { ListingRegistrationRepositoryImpl } from '@/infrastructure/repositories/ListingRegistrationRepositoryImpl';
import { SellerUseCase } from '@/application/usecases/SellerUseCase';
import { SellerRepositoryImpl } from '@/infrastructure/repositories/SellerRepositoryImpl';
import { CategoryUseCase } from '@/application/usecases/CategoryUseCase';
import { CategoryRepositoryImpl } from '@/infrastructure/repositories/CategoryRepositoryImpl';
import { CarrierRateUseCase } from '@/application/usecases/CarrierRateUseCase';
import { CarrierRateRepositoryImpl } from '@/infrastructure/repositories/CarrierRateRepositoryImpl';
import { PackageUseCase } from '@/application/usecases/PackageUseCase';
import { PackageRepositoryImpl } from '@/infrastructure/repositories/PackageRepositoryImpl';
import type { Seller } from '@/domain/entities/SellerEntity';
import type { Category } from '@/domain/entities/CategoryEntity';
import type { CarrierRate } from '@/domain/entities/CarrierRateEntity';
import type { Package } from '@/domain/entities/PackageEntity';
import type { MasterOptionResponse } from '@/domain/entities/MasterProductEntity';
import type { GeneratedProductResponse } from '@/domain/entities/ListingRegistrationEntity';

interface ChannelAddModalProps {
  masterId: number;
  options: MasterOptionResponse[];
  prefill?: { sellerId: number; platform: string };
  onDone: () => void;
  onClose: () => void;
}

const formatWon = (v: number) => `${v.toLocaleString('ko-KR')}원`;

/**
 * 채널 추가 마법사 (2단계: 폼 → 자동 생성 미리보기).
 * File: src/app/dashboard/master-products/[id]/components/ChannelAddModal.tsx
 *
 * - 폼: 판매자/플랫폼/카테고리/택배비/상자비/옵션(다중, 최소 1) → addChannel.
 * - 성공 시 같은 모달에서 미리보기(썸네일 + 옵션별 판매가) → [마켓 등록] 또는 [닫기].
 * - `options` 는 부모(09 매트릭스)에서 로드된 마스터 옵션 — 재fetch 금지.
 */
export function ChannelAddModal({ masterId, options, prefill, onDone, onClose }: ChannelAddModalProps) {
  const listingUseCase = useMemo(
    () => new ListingRegistrationUseCase(new ListingRegistrationRepositoryImpl()),
    [],
  );
  const sellerUseCase = useMemo(() => new SellerUseCase(new SellerRepositoryImpl()), []);
  const categoryUseCase = useMemo(() => new CategoryUseCase(new CategoryRepositoryImpl()), []);
  const carrierRateUseCase = useMemo(() => new CarrierRateUseCase(new CarrierRateRepositoryImpl()), []);
  const packageUseCase = useMemo(() => new PackageUseCase(new PackageRepositoryImpl()), []);

  // Dropdown sources
  const [sellers, setSellers] = useState<Seller[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [carrierRates, setCarrierRates] = useState<CarrierRate[]>([]);
  const [packages, setPackages] = useState<Package[]>([]);
  const [loadingOptions, setLoadingOptions] = useState(true);

  // Form state
  const [sellerId, setSellerId] = useState<number | ''>(prefill?.sellerId ?? '');
  const [platform, setPlatform] = useState<string>(prefill?.platform ?? '');
  const [categoryId, setCategoryId] = useState<number | ''>('');
  const [deliveryId, setDeliveryId] = useState<number | ''>('');
  const [packageId, setPackageId] = useState<number | ''>('');
  const [optionIds, setOptionIds] = useState<number[]>([]);

  const [fieldError, setFieldError] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Step 2 (preview)
  const [generated, setGenerated] = useState<GeneratedProductResponse | null>(null);
  const [listingId, setListingId] = useState<number | null>(null);
  const [isRegistering, setIsRegistering] = useState(false);
  const [registerDone, setRegisterDone] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoadingOptions(true);
      try {
        const [s, c, r, p] = await Promise.all([
          sellerUseCase.getAll(),
          categoryUseCase.getCategories(),
          carrierRateUseCase.getCarrierRates(),
          packageUseCase.getPackages(),
        ]);
        if (!alive) return;
        setSellers(s);
        setCategories(c);
        setCarrierRates(r);
        setPackages(p);
      } catch {
        if (alive) setError('선택 목록을 불러오지 못했습니다.');
      } finally {
        if (alive) setLoadingOptions(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [sellerUseCase, categoryUseCase, carrierRateUseCase, packageUseCase]);

  // Categories are platform-scoped; only show matching ones once a platform is chosen.
  const visibleCategories = platform
    ? categories.filter((c) => c.platform === platform)
    : categories;

  const toggleOption = (id: number) => {
    setOptionIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const handleSubmit = async () => {
    setFieldError('');
    setError('');
    if (sellerId === '' || !platform || categoryId === '' || deliveryId === '' || packageId === '') {
      setFieldError('판매자·플랫폼·카테고리·택배비·상자비를 모두 선택하세요.');
      return;
    }
    if (optionIds.length === 0) {
      setFieldError('옵션을 최소 1개 선택하세요.');
      return;
    }
    setIsSubmitting(true);
    try {
      const res = await listingUseCase.addChannel(masterId, {
        sellerId: Number(sellerId),
        platform,
        categoryId: Number(categoryId),
        deliveryId: Number(deliveryId),
        packageId: Number(packageId),
        optionIds,
      });
      setListingId(res.productListingId);
      setGenerated(res.generated);
    } catch {
      setError('채널 추가에 실패했습니다. 입력값을 확인하세요.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRegister = async () => {
    if (listingId == null) return;
    setError('');
    setIsRegistering(true);
    try {
      // Async: returns immediately as SUBMITTED; approval is confirmed later via refresh.
      await listingUseCase.register(listingId);
      setRegisterDone(true);
    } catch {
      setError('마켓 등록 요청에 실패했습니다.');
    } finally {
      setIsRegistering(false);
    }
  };

  const optionName = (id: number) => options.find((o) => o.id === id)?.name ?? `옵션 #${id}`;

  const inPreview = generated !== null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-lg bg-white p-5 shadow-lg">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">
            {inPreview ? '자동 생성 미리보기' : '채널 추가'}
          </h2>
          <button
            type="button"
            onClick={inPreview ? onDone : onClose}
            className="text-sm text-gray-500 hover:text-gray-800"
          >
            닫기
          </button>
        </div>

        {error && <p className="mb-4 rounded bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

        {!inPreview ? (
          <>
            {loadingOptions ? (
              <div className="flex min-h-32 items-center justify-center">
                <Spinner size={24} label="불러오는 중..." />
              </div>
            ) : (
              <div className="space-y-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-600">판매자</label>
                  <select
                    className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm text-gray-900"
                    value={sellerId}
                    onChange={(e) => setSellerId(e.target.value ? Number(e.target.value) : '')}
                  >
                    <option value="">선택</option>
                    {sellers.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.sellerName}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-600">플랫폼</label>
                  <select
                    className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm text-gray-900"
                    value={platform}
                    onChange={(e) => {
                      setPlatform(e.target.value);
                      setCategoryId('');
                    }}
                  >
                    <option value="">선택</option>
                    {PLATFORMS.map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-600">카테고리</label>
                  <select
                    className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm text-gray-900"
                    value={categoryId}
                    onChange={(e) => setCategoryId(e.target.value ? Number(e.target.value) : '')}
                  >
                    <option value="">선택</option>
                    {visibleCategories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-600">택배비</label>
                  <select
                    className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm text-gray-900"
                    value={deliveryId}
                    onChange={(e) => setDeliveryId(e.target.value ? Number(e.target.value) : '')}
                  >
                    <option value="">선택</option>
                    {carrierRates.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.carrier} {r.type} · {formatWon(r.cost)}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-600">상자비</label>
                  <select
                    className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm text-gray-900"
                    value={packageId}
                    onChange={(e) => setPackageId(e.target.value ? Number(e.target.value) : '')}
                  >
                    <option value="">선택</option>
                    {packages.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.type} · {formatWon(p.cost)}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-600">
                    옵션 (최소 1개)
                  </label>
                  {options.length === 0 ? (
                    <p className="text-xs text-gray-500">마스터에 등록된 옵션이 없습니다.</p>
                  ) : (
                    <div className="space-y-1 rounded border border-gray-200 p-2">
                      {options.map((o) => (
                        <label key={o.id} className="flex items-center gap-2 text-sm text-gray-800">
                          <input
                            type="checkbox"
                            checked={optionIds.includes(o.id)}
                            onChange={() => toggleOption(o.id)}
                          />
                          {o.name}
                        </label>
                      ))}
                    </div>
                  )}
                </div>

                {fieldError && <p className="text-sm text-red-600">{fieldError}</p>}

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={onClose}
                    disabled={isSubmitting}
                    className="rounded border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-100 disabled:opacity-50"
                  >
                    취소
                  </button>
                  <button
                    type="button"
                    onClick={handleSubmit}
                    disabled={isSubmitting}
                    className="flex items-center gap-1 rounded bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                  >
                    {isSubmitting ? <Spinner label="생성 중..." /> : '채널 추가'}
                  </button>
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="space-y-4">
            <div className="flex justify-center">
              {generated.thumbnailUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={resolveThumbUrl(generated.thumbnailUrl)}
                  alt="생성 썸네일"
                  className="max-h-48 rounded border border-gray-200"
                />
              ) : (
                <div className="flex h-48 w-48 items-center justify-center rounded bg-gray-100 text-xs text-gray-400">
                  썸네일 없음
                </div>
              )}
            </div>

            <div>
              <h3 className="mb-1 text-sm font-medium text-gray-700">옵션별 판매가</h3>
              <table className="w-full text-sm">
                <tbody>
                  {generated.optionPrices.map((op) => (
                    <tr key={op.optionId} className="border-b border-gray-100">
                      <td className="py-1.5 text-gray-800">{optionName(op.optionId)}</td>
                      <td className="py-1.5 text-right text-gray-900">{formatWon(op.sellingPrice)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <p className="text-xs text-gray-500">
              상세: 생성됨 ({generated.detailHtml ? generated.detailHtml.length : 0}자). 상세 편집은 별도 화면.
            </p>

            {registerDone ? (
              <p className="rounded bg-green-50 px-3 py-2 text-sm text-green-700">
                등록 요청이 접수되었습니다(SUBMITTED). 승인은 이후 &lsquo;승인 새로고침&rsquo;으로 확인하세요.
              </p>
            ) : (
              <p className="text-xs text-gray-500">
                로컬 자산만 저장된 상태입니다. 지금 마켓에 등록하거나 나중에 등록할 수 있습니다.
              </p>
            )}

            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={onDone}
                className="rounded border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-100"
              >
                닫기
              </button>
              {!registerDone && (
                <button
                  type="button"
                  onClick={handleRegister}
                  disabled={isRegistering}
                  className="flex items-center gap-1 rounded bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  {isRegistering ? <Spinner label="요청 중..." /> : '마켓에 등록'}
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
