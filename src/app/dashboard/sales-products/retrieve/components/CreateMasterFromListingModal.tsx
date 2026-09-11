'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Spinner } from '@/presentation/components/Spinner';
import { CategoryTreeColumns } from '@/presentation/components/CategoryTreeColumns';
import { CategoryUseCase } from '@/application/usecases/CategoryUseCase';
import { CategoryRepositoryImpl } from '@/infrastructure/repositories/CategoryRepositoryImpl';
import { ProductListingUseCase } from '@/application/usecases/ProductListingUseCase';
import { ProductListingRepositoryImpl } from '@/infrastructure/repositories/ProductListingRepositoryImpl';
import { extractErrorMessage } from '@/infrastructure/utils/errorMessage';
import type { ListingMasterPreview, ProductListing } from '@/domain/entities/ProductListingEntity';
import { Button } from '@/presentation/components/ui/Button';

interface CreateMasterFromListingModalProps {
  listing: ProductListing;
  onClose: () => void;
  /** 컨테이너: 목록 재조회 + 성공 배너. */
  onDone: (masterProductId: number) => void;
}

// 상태 enum → 화면 문구. ⚠️ enum 원문을 사용자에게 노출하지 않는다(UI 용어 규칙).
const STATUS_LABEL: Record<string, string> = {
  DRAFT: '미전송',
  SUBMITTED: '승인 대기중',
  SELLING: '판매중',
  REJECTED: '승인 반려',
  SUSPENDED: '판매 중지',
};

const won = (v: number | null | undefined) =>
  v == null ? '-' : v.toLocaleString('ko-KR');

/**
 * 판매상품 → 마스터 생성 모달 (2609_22 / D24~D31).
 * File: src/app/dashboard/sales-products/retrieve/components/CreateMasterFromListingModal.tsx
 *
 * 마스터 미연결 셀(legacy `판매상품 등록` 산출물)을 쿠팡 원본과 대조해 보여준 뒤, 이름·표준 카테고리만
 * 확정해 마스터를 만든다. 2단계 — ① 대조 리포트 ② 마스터명 + 카테고리.
 * - ⚠️ 옵션·가격·구성 입력칸을 만들지 않는다. 서버가 커밋 시점에 쿠팡을 재조회해 확정한다(D27).
 * - ⚠️ 미리보기 응답을 캐시하지 않는다. 모달을 닫으면 버린다.
 * - 확정 입력(마스터명·카테고리)은 1→2 전환 핸들러에서 **1회만** 시드한다.
 *   `useEffect([preview])` 로 걸면 재렌더마다 사용자 입력이 되돌아간다.
 * - 백엔드 400 문구는 가공하지 않고 그대로 노출한다 — 그 문구가 곧 사용자 행동 지침이다.
 */
export function CreateMasterFromListingModal({
  listing,
  onClose,
  onDone,
}: CreateMasterFromListingModalProps) {
  const listingUseCase = useMemo(
    () => new ProductListingUseCase(new ProductListingRepositoryImpl()),
    [],
  );
  // 카테고리는 컨테이너가 모른다 — 이 모달 안에서 만든다(props 로 browse 를 받지 않는다).
  const categoryUseCase = useMemo(() => new CategoryUseCase(new CategoryRepositoryImpl()), []);
  // ⚠️ 파라미터를 빠뜨리거나 인라인 화살표로 넘기면 CategoryTreeColumns 가 무한 remount 된다.
  const browse = useCallback(
    (pid?: number) => categoryUseCase.browseTree(pid),
    [categoryUseCase],
  );

  const [preview, setPreview] = useState<ListingMasterPreview | null>(null);
  const [step, setStep] = useState<1 | 2>(1);
  // 열자마자 미리보기를 부르므로 초기값이 곧 로딩 상태다(effect 안에서 동기 setState 하지 않기 위함).
  const [busy, setBusy] = useState(true); // 미리보기·생성 공용 스피너 + 재진입 가드
  const [error, setError] = useState('');

  // 2단계 확정 입력. 시드는 전환 핸들러에서만 한다(위 주석 참고).
  const [masterName, setMasterName] = useState('');
  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [categoryName, setCategoryName] = useState<string | null>(null);
  // 자동 인식된 카테고리를 [다시 고르기] 로 펼쳤는지. 인식 실패면 처음부터 펼친다.
  const [pickingCategory, setPickingCategory] = useState(false);

  // 열리면 즉시 미리보기 1회. 로딩 중 닫아도 언마운트 후 setState 하지 않는다.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await listingUseCase.previewMaster(listing.id);
        if (cancelled) return;
        setPreview(res);
      } catch (e: unknown) {
        if (cancelled) return;
        setError(extractErrorMessage(e, '미리보기에 실패했습니다.'));
      } finally {
        if (!cancelled) setBusy(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [listingUseCase, listing.id]);

  const goToStep2 = () => {
    if (preview == null) return;
    setMasterName(preview.suggestedMasterName ?? '');
    setCategoryId(preview.suggestedCategoryId);
    setCategoryName(preview.suggestedCategoryName);
    // D26: 인식 실패면 트리를 바로 펼친다.
    setPickingCategory(preview.suggestedCategoryId == null);
    setError('');
    setStep(2);
  };

  const canCreate = masterName.trim() !== '' && categoryId != null && !busy;

  const handleCreate = async () => {
    if (!canCreate || categoryId == null) return;
    setBusy(true);
    setError('');
    try {
      const res = await listingUseCase.createMaster(listing.id, {
        masterName: masterName.trim(),
        categoryId,
      });
      onDone(res.masterProductId);
      onClose();
    } catch (e: unknown) {
      setError(extractErrorMessage(e, '마스터 생성에 실패했습니다.'));
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="flex max-h-[85vh] w-full max-w-3xl flex-col overflow-y-auto rounded-lg bg-white p-5 shadow-lg">
        <div className="mb-4 flex shrink-0 items-center justify-between">
          <div className="min-w-0">
            <h2 className="text-lg font-semibold text-gray-900">
              마스터 생성 — {step}/2
            </h2>
            <p className="truncate text-xs text-gray-500">
              {listing.name} · {listing.platform} · 상품 ID {listing.platformProductId}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="shrink-0 text-sm text-gray-500 hover:text-gray-800 disabled:opacity-50"
          >
            닫기
          </button>
        </div>

        {error && (
          <p className="mb-3 shrink-0 rounded bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
        )}

        {busy && preview == null && !error && (
          <div className="flex shrink-0 items-center justify-center py-10 text-gray-500">
            <Spinner size={20} label="쿠팡 상품을 조회하는 중…" />
          </div>
        )}

        {/* ── Step 1: 대조 리포트 ────────────────────────────────── */}
        {preview && step === 1 && (
          <>
            <div className="shrink-0 space-y-2">
              <p className="text-sm text-gray-900">
                <span className="font-medium">{preview.coupangProductName}</span>
                <span className="text-gray-500">
                  {' '}
                  · {STATUS_LABEL[preview.status] ?? preview.status} · 쿠팡 카테고리 코드{' '}
                  {preview.categoryCode}
                </span>
              </p>
              {preview.coupangOnlyOptions.length > 0 && (
                <p className="rounded bg-amber-50 px-3 py-2 text-sm text-amber-700">
                  쿠팡에만 있는 옵션은 가져오지 않습니다: {preview.coupangOnlyOptions.join(', ')}
                </p>
              )}
            </div>

            <div className="my-3 min-h-0 flex-1 overflow-x-auto overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-100 border-b border-gray-200">
                  <tr>
                    <th className="px-3 py-2 text-left font-semibold text-gray-800">옵션</th>
                    <th className="px-3 py-2 text-left font-semibold text-gray-800">쿠팡 옵션명</th>
                    <th className="px-3 py-2 text-left font-semibold text-gray-800">
                      상품ID(현재 → 쿠팡)
                    </th>
                    <th className="px-3 py-2 text-right font-semibold text-gray-800">
                      판매가(현재 / 쿠팡)
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {preview.options.map((o) => (
                    <tr key={o.optionName} className={o.optionIdMismatch ? 'bg-amber-50' : ''}>
                      <td className="px-3 py-2 text-gray-900">{o.optionName}</td>
                      <td className="px-3 py-2 text-gray-700">{o.coupangItemName}</td>
                      <td className="px-3 py-2 text-gray-700">
                        {o.optionIdMismatch ? (
                          <span className="text-amber-700">
                            {o.currentOptionId ?? '-'} → {o.coupangVendorItemId ?? '-'}
                            <span className="ml-1 text-xs">⚠️ 커밋 시 쿠팡 값으로 교정됩니다</span>
                          </span>
                        ) : (
                          (o.currentOptionId ?? o.coupangVendorItemId ?? '-')
                        )}
                      </td>
                      <td className="px-3 py-2 text-right text-gray-700">
                        {won(o.currentPrice)} / {won(o.coupangPrice)}
                        {o.priceMismatch && (
                          <span className="ml-1 text-xs text-gray-500">
                            판매가는 현재 값이 유지됩니다
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {/* ── Step 2: 마스터명 + 표준 카테고리 ───────────────────── */}
        {preview && step === 2 && (
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700" htmlFor="master-name">
                마스터명
              </label>
              <input
                id="master-name"
                type="text"
                disabled={busy}
                value={masterName}
                onChange={(e) => setMasterName(e.target.value)}
                className="w-full rounded border border-gray-300 px-3 py-2 text-sm text-gray-900 disabled:bg-gray-100"
              />
            </div>

            <div>
              <p className="mb-1 text-sm font-medium text-gray-700">표준 카테고리</p>
              {categoryId != null && !pickingCategory ? (
                <div className="flex items-center gap-2 rounded border border-gray-200 bg-gray-50 px-3 py-2">
                  <span className="min-w-0 flex-1 truncate text-sm text-gray-900">
                    {preview.suggestedCategoryId === categoryId
                      ? `쿠팡 카테고리에서 자동 인식: ${categoryName ?? categoryId}`
                      : (categoryName ?? `카테고리 #${categoryId}`)}
                  </span>
                  <button
                    type="button"
                    onClick={() => setPickingCategory(true)}
                    disabled={busy}
                    className="shrink-0 rounded border border-gray-300 px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-100 disabled:opacity-50"
                  >
                    다시 고르기
                  </button>
                </div>
              ) : (
                <>
                  {preview.suggestedCategoryId == null && (
                    <p className="mb-2 text-xs text-gray-500">
                      쿠팡 카테고리를 인식하지 못했습니다. 표준 카테고리를 선택하세요.
                    </p>
                  )}
                  {/* miller-columns 는 컬럼이 늘수록 가로로 자란다 — 스크롤을 트리 안에 가둔다. */}
                  <div className="max-h-[45vh] overflow-x-auto overflow-y-auto">
                    <CategoryTreeColumns
                      browse={browse}
                      selectedId={categoryId}
                      onSelectLeaf={(leaf) => {
                        setCategoryId(leaf.id);
                        setCategoryName(leaf.name);
                        setPickingCategory(false);
                      }}
                    />
                  </div>
                </>
              )}
            </div>

            <div>
              <p className="mb-1 text-sm font-medium text-gray-700">
                구성 — 이 구성으로 마스터가 만들어집니다
              </p>
              <ul className="space-y-1 rounded border border-gray-200 px-3 py-2">
                {preview.components.map((c) => (
                  <li key={c.productId} className="truncate text-sm text-gray-900">
                    {c.brand ? `${c.brand} ` : ''}
                    {c.productName}
                  </li>
                ))}
              </ul>
            </div>

            <p className="text-xs text-gray-500">
              마스터는 이름·카테고리·구성만 채워집니다. 사진·태그·상세는 마스터 상세에서 이어서
              등록하세요.
            </p>
          </div>
        )}

        <div className="mt-4 flex shrink-0 flex-col items-end gap-1">
          <div className="flex justify-end gap-2">
            {step === 2 && (
              <button
                type="button"
                onClick={() => {
                  setError('');
                  setStep(1);
                }}
                disabled={busy}
                className="rounded border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-100 disabled:opacity-50"
              >
                이전
              </button>
            )}
            {preview && step === 1 && (
              <button
                type="button"
                onClick={goToStep2}
                className="rounded bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
              >
                다음
              </button>
            )}
            {preview && step === 2 && (
              <Button
                type="button"
                onClick={handleCreate}
                disabled={!canCreate}
                size="sm"
                className="flex items-center gap-1"
              >
                {busy ? <Spinner label="생성 중…" /> : '생성'}
              </Button>
            )}
          </div>
          {/* 비활성 사유를 숨기지 않는다 — 왜 못 누르는지 보여준다. */}
          {step === 2 && !busy && masterName.trim() === '' && (
            <p className="text-[11px] text-gray-500">마스터명을 입력하세요</p>
          )}
          {step === 2 && !busy && masterName.trim() !== '' && categoryId == null && (
            <p className="text-[11px] text-gray-500">표준 카테고리를 선택하세요</p>
          )}
        </div>
      </div>
    </div>
  );
}
