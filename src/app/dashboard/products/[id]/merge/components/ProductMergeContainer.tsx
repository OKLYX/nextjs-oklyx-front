'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import axios from 'axios';
import type { Product } from '@/domain/entities/Product';
import type { ProductImage } from '@/domain/entities/ProductImage';
import type { ProductUsage } from '@/domain/entities/ProductUsage';
import type { MergeTransferOptions } from '@/domain/repositories/ProductMergeRepository';
import { GetProductDetailUseCase } from '@/application/usecases/GetProductDetailUseCase';
import { GetProductsUseCase } from '@/application/usecases/GetProductsUseCase';
import { GetProductUsageUseCase } from '@/application/usecases/GetProductUsageUseCase';
import { FindProductByBarcodeUseCase } from '@/application/usecases/FindProductByBarcodeUseCase';
import { MergeProductsUseCase } from '@/application/usecases/MergeProductsUseCase';
import { ProductImageUseCase } from '@/application/usecases/ProductImageUseCase';
import { ProductRepositoryImpl } from '@/infrastructure/repositories/ProductRepositoryImpl';
import { ProductUsageRepositoryImpl } from '@/infrastructure/repositories/ProductUsageRepositoryImpl';
import { ProductImageRepositoryImpl } from '@/infrastructure/repositories/ProductImageRepositoryImpl';
import { ProductMergeRepositoryImpl } from '@/infrastructure/repositories/ProductMergeRepositoryImpl';
import { extractErrorMessage } from '@/infrastructure/utils/errorMessage';
import { getProductThumbUrl } from '@/infrastructure/utils/imageUrl';
import { resolveThumbUrl } from '@/infrastructure/utils/thumbUrl';
import { ImageLightbox } from '@/presentation/components/ImageLightbox';
import { ROUTES } from '@/config/routes';
import { PageContainer } from '@/presentation/components/PageContainer';
import { Button } from '@/presentation/components/ui/Button';
import { Card } from '@/presentation/components/ui/Card';
import { ConfirmDialog } from '@/presentation/components/ui/ConfirmDialog';
import { StateBlock } from '@/presentation/components/ui/StateBlock';
import { ProductUsageSection } from '../../components/ProductUsageSection';
import { MergeCounterpartSearch } from './MergeCounterpartSearch';
import { MergeFieldTable } from './MergeFieldTable';
import { MergeImagePicker } from './MergeImagePicker';
import { MergeTransferPanel } from './MergeTransferPanel';
import {
  TRANSFER_ROWS,
  buildMergedFields,
  defaultFieldChoices,
  isSameField,
  movedSummary,
  type MergeFieldKey,
  type MergeSide,
  type MergeSideData,
} from './mergeFields';

/**
 * 중복 물품 병합 화면 (FEATURE_2609_69 / B).
 *
 * **용도**: 중복 등록된 물품 2건을 나란히 놓고 **어느 쪽을 남길지 · 각 항목을 어느 쪽 값으로 할지**
 * 사람이 고른 뒤 병합한다. 자동 추천은 만들지 않는다(사용자 결정 2026-09-22).
 * **파일**: src/app/dashboard/products/[id]/merge/components/ProductMergeContainer.tsx
 *
 * **필수 규칙**
 * - 팝업이 아니라 **페이지**다. 긴 작업을 팝업에 넣지 않는다(선례: 마스터 생성 `/master-products/new`).
 * - 조회는 레이어드 usecase 로만 한다(`useQuery`/`useMutation` 금지).
 * - 연결 현황은 **02 의 `ProductUsageSection` 을 `compact` 로 재사용**한다. 다시 만들지 않는다.
 * - 🔴 **연결은 옮겨지지 않는다.** 버릴 쪽에 연결이 하나라도 있으면 [병합하기]를 막는다
 *   (서버도 409 로 거절한다 — 화면이 먼저 알려줄 뿐이다).
 * - 🔴 연결 현황 카드의 **[연결 새로고침]** 은 다른 탭에서 마스터·셀의 연결을 끊고 돌아온 사용자를 위한
 *   것이다(2026-09-24). 화면을 떠났다 오지 않아도 여기서 다시 조회해 막힌 [병합하기]가 풀린다.
 *   양쪽을 함께 다시 부른다 — 남길 쪽의 연결 수도 같이 변했을 수 있다.
 */
const ALL_TRANSFERRED: MergeTransferOptions = {
  purchaseRecords: true,
  stockMovements: true,
  shipmentItems: true,
  images: true,
  shoppingListItems: true,
  priceChangeLogs: true,
  appendMemo: true,
};

function linkCount(usage: ProductUsage): number {
  return usage.masterProducts.length + usage.listingOptions.length;
}

function historyCount(usage: ProductUsage): number {
  return TRANSFER_ROWS.reduce((sum, row) => sum + (usage.history[row.countKey] ?? 0), 0);
}

export function ProductMergeContainer({ id }: { id: number }) {
  const router = useRouter();

  const detailUseCase = useMemo(() => new GetProductDetailUseCase(new ProductRepositoryImpl()), []);
  const listUseCase = useMemo(() => new GetProductsUseCase(new ProductRepositoryImpl()), []);
  const barcodeLookupUseCase = useMemo(
    () => new FindProductByBarcodeUseCase(new ProductRepositoryImpl()),
    []
  );
  const usageUseCase = useMemo(() => new GetProductUsageUseCase(new ProductUsageRepositoryImpl()), []);
  const imageUseCase = useMemo(() => new ProductImageUseCase(new ProductImageRepositoryImpl()), []);
  const mergeUseCase = useMemo(() => new MergeProductsUseCase(new ProductMergeRepositoryImpl()), []);

  // 좌 = 들어올 때의 물품, 우 = 바코드/검색으로 고른 상대 물품.
  const [left, setLeft] = useState<MergeSideData | null>(null);
  const [leftError, setLeftError] = useState<string | null>(null);
  const [right, setRight] = useState<MergeSideData | null>(null);
  const [rightLoading, setRightLoading] = useState(false);
  const [rightError, setRightError] = useState<string | null>(null);

  const [keepSide, setKeepSide] = useState<MergeSide>('left');
  const [choices, setChoices] = useState<Record<MergeFieldKey, MergeSide> | null>(null);
  const [transfer, setTransfer] = useState<MergeTransferOptions>(ALL_TRANSFERRED);
  const [representativeImageId, setRepresentativeImageId] = useState<number | null>(null);

  const [isRefreshingUsage, setIsRefreshingUsage] = useState(false);
  const [usageRefreshError, setUsageRefreshError] = useState<string | null>(null);
  const [usageRefreshNotice, setUsageRefreshNotice] = useState<string | null>(null);

  const [showConfirm, setShowConfirm] = useState(false);
  const [isMerging, setIsMerging] = useState(false);
  const [mergeError, setMergeError] = useState<string | null>(null);
  const [barcodeConflict, setBarcodeConflict] = useState<string | null>(null);
  const [linkConflict, setLinkConflict] = useState<string | null>(null);
  const [mergedSummary, setMergedSummary] = useState<string | null>(null);
  const [mergedTargetId, setMergedTargetId] = useState<number | null>(null);

  /** 한쪽에 필요한 것 셋(상세·연결 현황·사진)을 한 번에 싣는다. */
  const loadSide = useCallback(
    async (productId: number): Promise<MergeSideData> => {
      const [product, usage, images] = await Promise.all([
        detailUseCase.getProduct(productId),
        usageUseCase.execute(productId),
        imageUseCase.list(productId),
      ]);
      return { product, usage, images: [...images].sort((a, b) => a.sortOrder - b.sortOrder) };
    },
    [detailUseCase, usageUseCase, imageUseCase]
  );

  const loadLeft = useCallback(async () => {
    setLeftError(null);
    try {
      setLeft(await loadSide(id));
    } catch (err) {
      setLeft(null);
      setLeftError(extractErrorMessage(err, '물품을 불러오지 못했습니다.'));
    }
  }, [id, loadSide]);

  // 프로젝트 표준 회피책 — 이펙트 본문에서 곧바로 setState 하면 lint `set-state-in-effect`(error) 다.
  useEffect(() => {
    void (async () => {
      await loadLeft();
    })();
  }, [loadLeft]);

  /**
   * 남길 쪽이 정해지면 항목 선택과 대표 사진을 그 기준으로 다시 깐다.
   * 🔴 이것은 **초기값**일 뿐 추천이 아니다 — 「남길 쪽은 자기 값을 그대로 이어간다」는 규칙의 결과다.
   */
  const applySideDefaults = useCallback(
    (side: MergeSide, leftData: MergeSideData, rightData: MergeSideData) => {
      const keep = side === 'left' ? leftData : rightData;
      const discard = side === 'left' ? rightData : leftData;
      setKeepSide(side);
      setChoices(defaultFieldChoices(keep.product, discard.product, side));
      setRepresentativeImageId(keep.images[0]?.id ?? null);
      setBarcodeConflict(null);
      setLinkConflict(null);
      setMergeError(null);
      setUsageRefreshNotice(null);
      setUsageRefreshError(null);
    },
    []
  );

  /**
   * 상대 물품을 고른 순간 기본 남길 쪽을 정한다: 연결이 많은 쪽 → 이력이 많은 쪽 → 왼쪽(들어온 물품).
   */
  const handleSelectCounterpart = useCallback(
    async (product: Product) => {
      if (!left) return;
      setRightLoading(true);
      setRightError(null);
      try {
        const rightData = await loadSide(product.id);
        setRight(rightData);
        setTransfer(ALL_TRANSFERRED);

        const leftLinks = linkCount(left.usage);
        const rightLinks = linkCount(rightData.usage);
        let side: MergeSide = 'left';
        if (rightLinks > leftLinks) {
          side = 'right';
        } else if (rightLinks === leftLinks && historyCount(rightData.usage) > historyCount(left.usage)) {
          side = 'right';
        }
        applySideDefaults(side, left, rightData);
      } catch (err) {
        setRight(null);
        setRightError(extractErrorMessage(err, '상대 물품을 불러오지 못했습니다.'));
      } finally {
        setRightLoading(false);
      }
    },
    [left, loadSide, applySideDefaults]
  );

  const handleKeepSideChange = useCallback(
    (side: MergeSide) => {
      if (!left || !right || side === keepSide) return;
      applySideDefaults(side, left, right);
    },
    [left, right, keepSide, applySideDefaults]
  );

  /** 상대 물품을 다시 고른다 — 고른 값·남길 쪽·오류 문구를 전부 처음 상태로 되돌린다. */
  const handleClearCounterpart = useCallback(() => {
    setRight(null);
    setKeepSide('left');
    setChoices(null);
    setRepresentativeImageId(null);
    setTransfer(ALL_TRANSFERRED);
    setBarcodeConflict(null);
    setLinkConflict(null);
    setMergeError(null);
    setUsageRefreshNotice(null);
    setUsageRefreshError(null);
  }, []);

  /**
   * 연결 현황만 다시 불러온다 — 다른 탭에서 마스터·셀의 연결을 끊고 돌아온 경우.
   *
   * 🔴 상세·사진은 그대로 두고 `usage` 만 갈아끼운다. 여기서 화면을 통째로 다시 그리면
   *    고른 항목 값·남길 쪽 선택이 초기화돼 사용자가 하던 일을 잃는다.
   * 🔴 양쪽을 함께 부른다 — 남길 쪽의 연결 수도 그 사이 달라졌을 수 있다.
   */
  const handleRefreshUsage = useCallback(async () => {
    if (!left) return;
    setIsRefreshingUsage(true);
    setUsageRefreshError(null);
    setUsageRefreshNotice(null);
    try {
      const rightId = right?.product.id ?? null;
      const [leftUsage, rightUsage] = await Promise.all([
        usageUseCase.execute(left.product.id),
        rightId === null
          ? Promise.resolve<ProductUsage | null>(null)
          : usageUseCase.execute(rightId),
      ]);
      setLeft((prev) => (prev ? { ...prev, usage: leftUsage } : prev));
      if (rightUsage) setRight((prev) => (prev ? { ...prev, usage: rightUsage } : prev));

      // 서버가 막던 사유가 사라졌으면 그 문구도 같이 거둔다 — 낡은 빨간 문구가 남으면 여전히 막힌 줄 안다.
      setLinkConflict(null);
      const discardUsage = keepSide === 'left' ? rightUsage : leftUsage;
      if (discardUsage) {
        const remaining = linkCount(discardUsage);
        setUsageRefreshNotice(
          remaining === 0
            ? '버릴 물품에 남은 연결이 없습니다 — 이제 병합할 수 있습니다.'
            : `버릴 물품에 연결이 아직 ${remaining}건 남아 있습니다.`
        );
      }
    } catch (err) {
      setUsageRefreshError(extractErrorMessage(err, '연결 현황을 다시 불러오지 못했습니다.'));
    } finally {
      setIsRefreshingUsage(false);
    }
  }, [left, right, keepSide, usageUseCase]);

  const handleFieldChoice = useCallback((key: MergeFieldKey, side: MergeSide) => {
    setChoices((prev) => (prev ? { ...prev, [key]: side } : prev));
    if (key === 'barcodeId') setBarcodeConflict(null);
  }, []);

  const keepData = keepSide === 'left' ? left : right;
  const discardData = keepSide === 'left' ? right : left;

  /**
   * 「사진」을 끄면 버릴 쪽 사진은 대표가 될 수 없다 — 그대로 보내면 서버가 400 을 낸다.
   * 끄는 순간 선택을 남길 쪽 대표로 되돌린다.
   */
  const handleTransferChange = useCallback(
    (key: keyof MergeTransferOptions, value: boolean) => {
      setTransfer((prev) => ({ ...prev, [key]: value }));
      if (key === 'images' && !value && keepData && discardData) {
        const isDiscardImage = discardData.images.some((image) => image.id === representativeImageId);
        if (isDiscardImage) setRepresentativeImageId(keepData.images[0]?.id ?? null);
      }
    },
    [keepData, discardData, representativeImageId]
  );

  const discardHasLinks = discardData ? linkCount(discardData.usage) > 0 : false;
  const canMerge =
    !!keepData && !!discardData && !!choices && !rightLoading && !isMerging && !discardHasLinks;

  const confirmSummary = useMemo(() => {
    if (!keepData || !discardData) return null;
    const moving = TRANSFER_ROWS.filter(
      (row) => transfer[row.key] && (discardData.usage.history[row.countKey] ?? 0) > 0
    );
    const skipped = TRANSFER_ROWS.filter(
      (row) => !transfer[row.key] && (discardData.usage.history[row.countKey] ?? 0) > 0
    );
    return {
      keep: `#${keepData.product.id} ${keepData.product.productName}`,
      discard: `#${discardData.product.id} ${discardData.product.productName}`,
      moving: moving
        .map((row) => `${row.shortLabel} ${discardData.usage.history[row.countKey]}`)
        .join(' · '),
      skipped: skipped.map((row) => row.shortLabel).join('·'),
      memo: transfer.appendMemo,
    };
  }, [keepData, discardData, transfer]);

  const handleMerge = useCallback(async () => {
    if (!keepData || !discardData || !choices) return;
    setIsMerging(true);
    setMergeError(null);
    setBarcodeConflict(null);
    setLinkConflict(null);
    try {
      const response = await mergeUseCase.execute({
        targetProductId: keepData.product.id,
        sourceProductId: discardData.product.id,
        fields: buildMergedFields(
          keepData.product,
          discardData.product,
          keepSide,
          choices,
          representativeImageId
        ),
        transfer,
      });
      setShowConfirm(false);
      setMergedTargetId(response.targetProductId);
      const summary = movedSummary(response.moved);
      // 🔴 `snapshotFileName` 은 화면에 쓰지 않는다 — 되돌릴 근거일 뿐 사용자가 쓸 값이 아니다.
      setMergedSummary(summary ? `${summary} 를 옮겼습니다.` : '옮길 기록은 없었습니다.');
    } catch (err) {
      const status = axios.isAxiosError(err) ? err.response?.status : undefined;
      const message = extractErrorMessage(err, '병합하지 못했습니다.');
      setShowConfirm(false);
      if (status === 409 && message.includes('바코드')) {
        // 제3 물품이 그 바코드를 갖고 있다 → 바코드 줄 아래에 서버 문구 그대로.
        setBarcodeConflict(message);
      } else if (status === 409) {
        setLinkConflict(message);
      } else if (status !== undefined && status >= 500) {
        setMergeError('병합에 실패했습니다. 아무것도 변경되지 않았습니다.');
      } else {
        setMergeError(message);
      }
    } finally {
      setIsMerging(false);
    }
  }, [keepData, discardData, choices, keepSide, representativeImageId, transfer, mergeUseCase]);

  // 바코드가 양쪽 같으면 그 줄이 숨겨져 409 문구를 붙일 자리가 없다 → 아래 오류 영역에 그대로 띄운다.
  const barcodeConflictHasNoRow =
    !!barcodeConflict &&
    !!keepData &&
    !!discardData &&
    isSameField(keepData.product, discardData.product, 'barcodeId');

  const backHref = ROUTES.PRODUCT_DETAIL(id);

  if (leftError) {
    return (
      <PageContainer title="중복 물품 병합">
        <Card padded={false}>
          <StateBlock variant="error" message={leftError} />
        </Card>
      </PageContainer>
    );
  }

  if (!left) {
    return (
      <PageContainer title="중복 물품 병합">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <SideSkeleton />
          <SideSkeleton />
        </div>
      </PageContainer>
    );
  }

  return (
    <PageContainer title="중복 물품 병합">
      <div>
        <Button variant="secondary" size="sm" onClick={() => router.push(backHref)}>
          ← 물품 상세
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <SideCard
          data={left}
          isKeep={keepSide === 'left'}
          selectable={!!right && !isMerging}
          onKeep={() => handleKeepSideChange('left')}
        />
        {right ? (
          <SideCard
            data={right}
            isKeep={keepSide === 'right'}
            selectable={!isMerging}
            onKeep={() => handleKeepSideChange('right')}
            onClear={isMerging ? undefined : handleClearCounterpart}
          />
        ) : rightLoading ? (
          <SideSkeleton />
        ) : (
          <MergeCounterpartSearch
            currentProductId={id}
            findByBarcode={barcodeLookupUseCase}
            getProducts={listUseCase}
            initialBarcode={left.product.barcodeId}
            onSelect={handleSelectCounterpart}
          />
        )}
      </div>

      {rightError && (
        <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{rightError}</div>
      )}

      {keepData && discardData && choices && (
        <>
          <MergeFieldTable
            keep={keepData.product}
            discard={discardData.product}
            keepSide={keepSide}
            choices={choices}
            onChange={handleFieldChoice}
            barcodeConflict={barcodeConflict}
            disabled={isMerging}
          />

          <MergeImagePicker
            keepImages={keepData.images}
            discardImages={discardData.images}
            imagesTransferred={transfer.images}
            representativeImageId={representativeImageId}
            onSelect={setRepresentativeImageId}
            disabled={isMerging}
          />

          <MergeTransferPanel
            discardHistory={discardData.usage.history}
            transfer={transfer}
            onChange={handleTransferChange}
            disabled={isMerging}
          />

          {/* 연결 현황 — 02 의 컴포넌트를 좌우에 하나씩. 🔴 연결은 옮겨지지 않는다 */}
          <Card
            title="연결 현황"
            action={
              <Button
                size="sm"
                variant="secondary"
                onClick={() => void handleRefreshUsage()}
                isLoading={isRefreshingUsage}
                loadingText="불러오는 중…"
                disabled={isMerging}
              >
                연결 새로고침
              </Button>
            }
          >
            <div className="rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800">
              <p>연결(마스터 구성품 · 판매 옵션 구성품)은 옮겨지지 않습니다.</p>
              <p>버릴 물품에 연결이 남아 있으면 삭제할 수 없습니다 — 마스터와 셀에서 먼저 빼주세요.</p>
              <p>다른 탭에서 연결을 끊었다면 [연결 새로고침]으로 다시 불러오세요.</p>
            </div>
            {linkConflict && (
              <p className="mt-3 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{linkConflict}</p>
            )}
            {usageRefreshError && (
              <p className="mt-3 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
                {usageRefreshError}
              </p>
            )}
            {usageRefreshNotice && (
              <p className="mt-3 text-sm text-gray-600">{usageRefreshNotice}</p>
            )}
            <div className="mt-4 grid grid-cols-1 gap-6 lg:grid-cols-2">
              <div className="space-y-2">
                <p className="text-xs text-gray-500">
                  남길 물품 #{keepData.product.id} · 기록 {historyCount(keepData.usage)}건
                </p>
                <ProductUsageSection
                  usage={keepData.usage}
                  isLoading={false}
                  error={null}
                  onRetry={() => void handleRefreshUsage()}
                  compact
                />
              </div>
              <div className="space-y-2">
                <p className="text-xs text-gray-500">
                  버릴 물품 #{discardData.product.id} · 기록 {historyCount(discardData.usage)}건
                </p>
                <ProductUsageSection
                  usage={discardData.usage}
                  isLoading={false}
                  error={null}
                  onRetry={() => void handleRefreshUsage()}
                  compact
                />
              </div>
            </div>
          </Card>

          {(mergeError || barcodeConflictHasNoRow) && (
            <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
              {mergeError ?? barcodeConflict}
            </div>
          )}

          <div className="flex items-center justify-end gap-3">
            {discardHasLinks && (
              <span className="text-sm text-red-600">
                버릴 물품에 연결이 남아 있어 병합할 수 없습니다 — 마스터와 셀에서 먼저 빼주세요.
              </span>
            )}
            <Button
              variant="danger"
              disabled={!canMerge}
              isLoading={isMerging}
              loadingText="병합 중…"
              onClick={() => setShowConfirm(true)}
            >
              병합하기
            </Button>
          </div>
        </>
      )}

      {/* 실행 확인 — 무엇이 남고 무엇이 옮겨지는지 요약. 🔴 백드롭을 직접 만들지 않는다 */}
      <ConfirmDialog
        isOpen={showConfirm && !!confirmSummary}
        title="물품 병합"
        message={
          confirmSummary ? (
            <div className="space-y-1 text-base">
              <p>남길 물품: {confirmSummary.keep}</p>
              <p>버릴 물품: {confirmSummary.discard} (목록에서 숨겨집니다)</p>
              <p>
                옮길 기록: {confirmSummary.moving || '없음'}
                {confirmSummary.skipped && ` (${confirmSummary.skipped}은 안 옮김)`}
              </p>
              {confirmSummary.memo && <p>설명에 메모 남김</p>}
            </div>
          ) : (
            ''
          )
        }
        confirmText="병합"
        isDangerous
        isLoading={isMerging}
        onConfirm={handleMerge}
        onCancel={() => setShowConfirm(false)}
      />

      {/* 완료 안내 — 확인하면 남긴 물품 상세로 간다(상세가 마운트되며 스스로 다시 불러온다). */}
      <ConfirmDialog
        isOpen={mergedSummary !== null}
        title="병합 완료"
        message={mergedSummary ?? ''}
        confirmText="남긴 물품 보기"
        onConfirm={() => {
          setMergedSummary(null);
          router.push(ROUTES.PRODUCT_DETAIL(mergedTargetId ?? id));
        }}
      />
    </PageContainer>
  );
}

/** 좌우 한 칸 — 남길 쪽 선택 + 물품 요약. 🔴 「추천」 같은 라벨을 붙이지 않는다 */
function SideCard({
  data,
  isKeep,
  selectable,
  onKeep,
  onClear,
}: {
  data: MergeSideData;
  isKeep: boolean;
  selectable: boolean;
  onKeep: () => void;
  onClear?: () => void;
}) {
  return (
    <Card className={isKeep ? 'ring-2 ring-blue-500' : undefined}>
      <div className="flex items-start justify-between gap-3">
        <label className={`flex items-center gap-2 ${selectable ? 'cursor-pointer' : 'cursor-default'}`}>
          <input
            type="radio"
            name="merge-keep-side"
            checked={isKeep}
            disabled={!selectable}
            onChange={onKeep}
          />
          <span className="font-semibold text-gray-900">이 물품을 남긴다</span>
        </label>
        {onClear && (
          <Button size="sm" variant="secondary" onClick={onClear}>
            다시 고르기
          </Button>
        )}
      </div>
      <div className="mt-3 flex items-start gap-3">
        <SideThumbnail product={data.product} images={data.images} />
        <div className="min-w-0">
          <p className="text-lg font-semibold text-gray-900">
            #{data.product.id} {data.product.productName}
          </p>
          <p className="mt-1 text-sm text-gray-600">
            {data.product.brand || '브랜드 없음'} · 바코드 {data.product.barcodeId || '없음'}
          </p>
          <p className="mt-1 text-sm text-gray-600">
            연결 {linkCount(data.usage)} · 기록 {historyCount(data.usage)}건 · 사진{' '}
            {data.images.length}장
          </p>
        </div>
      </div>
    </Card>
  );
}

/**
 * 좌우 칸의 대표 사진 — 이름이 비슷한 두 물품을 눈으로 가르는 가장 빠른 단서다.
 * 누르면 공용 `ImageLightbox` 로 **그 물품의 사진 전부**를 크게 본다(◀▶ 로 넘김).
 * 갤러리를 못 받았으면(사진 목록이 비었으면) 대표 사진 한 장만 띄운다.
 */
function SideThumbnail({ product, images }: { product: Product; images: ProductImage[] }) {
  const [zoomIndex, setZoomIndex] = useState<number | null>(null);
  const src = getProductThumbUrl(product.imageUrl, product.id);
  if (!src) {
    return (
      <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded border border-gray-200 bg-gray-50 text-xs text-gray-300">
        없음
      </div>
    );
  }
  const zoomImages =
    images.length > 0
      ? images.map((image) => ({ url: resolveThumbUrl(image.imageUrl), alt: product.productName }))
      : [{ url: src, alt: product.productName }];
  return (
    <>
      <button
        type="button"
        onClick={() => setZoomIndex(0)}
        aria-label={`${product.productName} 사진 크게 보기`}
        title="크게 보기"
        className="shrink-0"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt={product.productName}
          className="h-16 w-16 cursor-zoom-in rounded border border-gray-200 bg-gray-50 object-cover"
        />
      </button>
      <ImageLightbox
        images={zoomImages}
        index={zoomIndex}
        onIndexChange={setZoomIndex}
        onClose={() => setZoomIndex(null)}
      />
    </>
  );
}

function SideSkeleton() {
  return (
    <Card>
      <div className="space-y-3">
        <div className="h-4 w-32 animate-pulse rounded bg-gray-200" />
        <div className="h-6 w-2/3 animate-pulse rounded bg-gray-100" />
        <div className="h-4 w-full animate-pulse rounded bg-gray-100" />
        <div className="h-4 w-1/2 animate-pulse rounded bg-gray-100" />
      </div>
    </Card>
  );
}
