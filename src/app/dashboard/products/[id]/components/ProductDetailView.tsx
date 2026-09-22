'use client';

import { useCallback, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Product } from '@/domain/entities/Product';
import type { ProductUsage } from '@/domain/entities/ProductUsage';
import { deleteBlockedReason } from '@/domain/entities/ProductUsage';
import type { ProductImageUseCase } from '@/application/usecases/ProductImageUseCase';
import type { BarcodeExtractionUseCase } from '@/application/usecases/BarcodeExtractionUseCase';
import { ProductImageGallery } from './ProductImageGallery';
import { ProductUsageSection } from './ProductUsageSection';
import { ConfirmDialog } from '@/presentation/components/ui/ConfirmDialog';
import { Button } from '@/presentation/components/ui/Button';
import { Card } from '@/presentation/components/ui/Card';
import { ROUTES } from '@/config/routes';
import { formatKrw } from '@/infrastructure/utils/money';
import { extractErrorMessage } from '@/infrastructure/utils/errorMessage';
import { useClipboardStore, newClipId } from '@/infrastructure/stores/clipboardStore';
import type { ClipValues } from '@/domain/entities/ClipItem';
import { barcodeResultText } from '@/infrastructure/utils/barcodeExtraction';

interface ProductDetailViewProps {
  product: Product;
  /** 연결 현황 (FEATURE_2609_69 / A). 아직 안 실렸거나 실패하면 null */
  usage: ProductUsage | null;
  usageLoading: boolean;
  usageError: string | null;
  /** 연결 현황 재조회 — 「다시 시도」와 삭제 거부(409) 후에 부른다 */
  onReloadUsage: () => void;
  onDelete: () => Promise<void>;
  imageUseCase: ProductImageUseCase;
  barcodeUseCase: BarcodeExtractionUseCase;
  /** 사진에서 바코드를 읽어 저장한 직후 — 화면 값만 갈아 끼운다(재조회가 아니다). */
  onBarcodeExtracted: (barcode: string) => void;
  /** [← 목록] 목적지. 목록에서 들어왔으면 그 페이지·검색어가 붙어 있다. */
  backHref: string;
  /** [수정] 목적지. 목록 조회 조건을 그대로 달고 간다. */
  editHref: string;
}

export function ProductDetailView({
  product,
  usage,
  usageLoading,
  usageError,
  onReloadUsage,
  onDelete,
  imageUseCase,
  barcodeUseCase,
  onBarcodeExtracted,
  backHref,
  editHref,
}: ProductDetailViewProps) {
  const router = useRouter();
  const [showDeleteConfirmation, setShowDeleteConfirmation] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const [isPicking, setIsPicking] = useState(false);
  const [clipNotice, setClipNotice] = useState('');
  const [isExtracting, setIsExtracting] = useState(false);
  const [barcodeNotice, setBarcodeNotice] = useState('');
  const [showOverwriteConfirm, setShowOverwriteConfirm] = useState(false);
  const addClip = useClipboardStore((state) => state.add);

  // 클립보드에 이 물품을 통째로 담는다 — 값은 스냅샷(문자열), 사진은 참조(productImageId).
  // 🔴 상품명·바코드는 값으로 담지 않는다(바코드는 물품을 구분하는 값이라 복제하면 중복이 생긴다).
  const handlePickProduct = useCallback(async () => {
    setIsPicking(true);
    setClipNotice('');
    try {
      const images = await imageUseCase.list(product.id);
      const values: ClipValues = {};
      // 🔴 폼(RHF)이 전부 string 이라 담을 때부터 문자열로 맞춘다. 빈 값은 담지 않는다.
      const put = (key: keyof ClipValues, value: string | number | null | undefined) => {
        const text = value == null ? '' : String(value).trim();
        if (text !== '') values[key] = text;
      };
      put('brand', product.brand);
      put('store', product.store);
      put('price', product.price);
      put('netContent', product.netContent);
      put('netContentUnit', product.netContentUnit);
      put('packageWidth', product.packageWidth);
      put('packageLength', product.packageLength);
      put('packageHeight', product.packageHeight);
      put('description', product.description);
      addClip({
        clipId: newClipId(),
        kind: 'product',
        pickedAt: new Date().toISOString(),
        productId: product.id,
        productName: product.productName,
        values,
        imageRefs: [...images]
          .sort((a, b) => a.sortOrder - b.sortOrder)
          .map((img) => ({ productImageId: img.id, imageUrl: img.imageUrl })),
      });
      setClipNotice('클립보드에 담았습니다.');
    } catch {
      setClipNotice('클립보드에 담지 못했습니다.');
    } finally {
      setIsPicking(false);
    }
  }, [addClip, imageUseCase, product]);

  // 사진에서 바코드를 읽어 채운다 (FEATURE_2609_65). 🔴 대부분 실패하는 기능이라
  // 결과를 뭉뚱그리지 않고 원인별 문장을 그대로 보여준다(PLAN §3).
  const runExtract = useCallback(
    async (overwrite: boolean) => {
      setShowOverwriteConfirm(false);
      setIsExtracting(true);
      setBarcodeNotice('');
      try {
        // 🔴 엔드포인트가 하나라 단건도 id 1개짜리 배열로 보낸다(PLAN D1).
        const result = await barcodeUseCase.extract([product.id], overwrite);
        const item = result.items[0];
        if (!item) {
          setBarcodeNotice('바코드를 추출하지 못했습니다');
          return;
        }
        setBarcodeNotice(barcodeResultText(item));
        if (item.status === 'EXTRACTED' && item.barcode) {
          onBarcodeExtracted(item.barcode);
        }
      } catch {
        setBarcodeNotice('바코드를 추출하지 못했습니다');
      } finally {
        setIsExtracting(false);
      }
    },
    [barcodeUseCase, product.id, onBarcodeExtracted]
  );

  const handleExtractClick = useCallback(() => {
    if (product.barcodeId) {
      setShowOverwriteConfirm(true);
      return;
    }
    runExtract(false);
  }, [product.barcodeId, runExtract]);

  /**
   * 삭제 (FEATURE_2609_69 / A).
   *
   * 🔴 서버 가드가 최종 판정이다 — 화면이 [삭제]를 열어줬어도 그새 연결이 생겼으면 409 가 온다.
   * 그때는 **서버 문구를 그대로** 보여주고 연결 현황을 다시 싣는다.
   */
  const handleDeleteConfirm = useCallback(async () => {
    setIsDeleting(true);
    setDeleteError('');
    try {
      await onDelete();
      router.push(backHref);
    } catch (err) {
      setIsDeleting(false);
      setShowDeleteConfirmation(false);
      setDeleteError(extractErrorMessage(err, '삭제하지 못했습니다.'));
      onReloadUsage();
    }
  }, [onDelete, router, backHref, onReloadUsage]);

  // 연결 현황이 아직 안 실렸으면 누르지 못하게 둔다. 실패(usage === null + usageError)면 서버 가드에 맡긴다.
  const deleteBlocked = usage !== null && !usage.deletable;
  const summary = usage
    ? `마스터 ${usage.masterProducts.length} · 판매 옵션 ${usage.listingOptions.length}`
    : '-';
  const hasLinks =
    usage !== null && (usage.masterProducts.length > 0 || usage.listingOptions.length > 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-2">
        <Button variant="secondary" size="sm" onClick={() => router.push(backHref)}>
          ← 목록
        </Button>
        <div className="flex items-center gap-2">
          {clipNotice && <span className="text-sm text-gray-600">{clipNotice}</span>}
          {barcodeNotice && <span className="text-sm text-gray-600">{barcodeNotice}</span>}
          <Button variant="secondary" onClick={handlePickProduct} disabled={isPicking}>
            클립보드에 담기
          </Button>
          <Button variant="secondary" onClick={handleExtractClick} disabled={isExtracting}>
            {isExtracting ? '추출 중…' : '바코드 추출'}
          </Button>
          {/* 중복 병합 (FEATURE_2609_69 / B) — 같은 물건이 두 번 등록된 경우 이 물품을 한쪽에 놓고 시작한다 */}
          <Button variant="secondary" onClick={() => router.push(ROUTES.PRODUCT_MERGE(product.id))}>
            중복 병합
          </Button>
          <Button onClick={() => router.push(editHref)}>수정</Button>
          {/* 🔴 삭제 버튼은 이 하나뿐이다. 연결 섹션 옆에 두 번째 삭제 버튼을 만들지 않는다. */}
          <Button
            variant="danger"
            disabled={usageLoading || deleteBlocked}
            onClick={() => setShowDeleteConfirmation(true)}
          >
            삭제
          </Button>
        </div>
      </div>

      {/* 삭제가 막힌 사유 · 삭제 실패 문구. 🔴 둘 다 서버 문구 그대로 쓴다 */}
      {(deleteBlocked || deleteError) && (
        <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          {deleteError || (usage ? deleteBlockedReason(usage.blockers) : '')}
        </div>
      )}

      {/* 연결 요약 (FEATURE_2609_69 / A) */}
      <Card>
        <p className="text-sm text-gray-600">연결</p>
        {hasLinks ? (
          <p className="text-lg font-semibold text-gray-900">{summary}</p>
        ) : (
          <p className="text-lg font-semibold text-gray-400">
            {usageLoading || usageError ? summary : '연결 없음'}
          </p>
        )}
      </Card>

      {/* Product Details */}
      <div className="grid grid-cols-2 gap-6">
        <Card>
          <div className="space-y-4">
            <div>
              <p className="text-sm text-gray-600">상품명</p>
              <p className="text-lg font-semibold text-gray-900">{product.productName}</p>
            </div>
            {product.barcodeId && (
              <div>
                <p className="text-sm text-gray-600">바코드 ID</p>
                <p className="text-lg font-semibold text-gray-900">{product.barcodeId}</p>
              </div>
            )}
            {product.brand && (
              <div>
                <p className="text-sm text-gray-600">브랜드</p>
                <p className="text-lg font-semibold text-gray-900">{product.brand}</p>
              </div>
            )}
            {product.price && (
              <div>
                <p className="text-sm text-gray-600">가격</p>
                <p className="text-lg font-semibold text-gray-900">{formatKrw(product.price)}</p>
              </div>
            )}
            {product.store && (
              <div>
                <p className="text-sm text-gray-600">구매처</p>
                <p className="text-lg font-semibold text-gray-900">{product.store}</p>
              </div>
            )}
            {product.netContentUnit && (
              <div>
                <p className="text-sm text-gray-600">단위</p>
                <p className="text-lg font-semibold text-gray-900">{product.netContentUnit}</p>
              </div>
            )}
          </div>
        </Card>

        <Card>
          <div className="space-y-4">
            {product.packageHeight && (
              <div>
                <p className="text-sm text-gray-600">높이</p>
                <p className="text-lg font-semibold text-gray-900">{product.packageHeight}</p>
              </div>
            )}
            {product.packageLength && (
              <div>
                <p className="text-sm text-gray-600">길이</p>
                <p className="text-lg font-semibold text-gray-900">{product.packageLength}</p>
              </div>
            )}
            {product.packageWidth && (
              <div>
                <p className="text-sm text-gray-600">너비</p>
                <p className="text-lg font-semibold text-gray-900">{product.packageWidth}</p>
              </div>
            )}
            {product.netContent && (
              <div>
                <p className="text-sm text-gray-600">내용물 양</p>
                <p className="text-lg font-semibold text-gray-900">{product.netContent}</p>
              </div>
            )}
          </div>
        </Card>
      </div>

      {/* Description */}
      {product.description && (
        <Card title="설명">
          <p className="text-gray-700 whitespace-pre-wrap">{product.description}</p>
        </Card>
      )}

      {/* 연결 현황 — 마스터 상품 / 판매 옵션. 04(병합 화면)가 같은 컴포넌트를 좌우로 쓴다 */}
      <ProductUsageSection
        usage={usage}
        isLoading={usageLoading}
        error={usageError}
        onRetry={onReloadUsage}
      />

      {/* 기록 — 병합할 때 어느 쪽이 실제로 쓰이는지 보는 값이다.
          🔴 「최근 매입 날짜」는 넣지 않는다. 어느 응답에도 그 값이 없다(건수만 있다). */}
      <Card title="기록">
        <div className="grid grid-cols-2 gap-x-8 gap-y-2 text-sm md:grid-cols-4">
          <RecordRow label="등록일" value={product.createdDate?.substring(0, 10) ?? '-'} />
          <RecordRow label="최종 수정" value={product.modifiedDate?.substring(0, 10) ?? '-'} />
          <RecordRow label="재고 이동" value={countText(usage?.history.stockMovements, '건')} />
          <RecordRow label="매입 이력" value={countText(usage?.history.purchaseRecords, '건')} />
          <RecordRow label="발송 내역" value={countText(usage?.history.shipmentItems, '건')} />
          <RecordRow label="사진" value={countText(usage?.history.images, '장')} />
          <RecordRow label="구매목록" value={countText(usage?.history.shoppingListItems, '건')} />
          <RecordRow label="가격 이력" value={countText(usage?.history.priceChangeLogs, '건')} />
        </div>
      </Card>

      {/* Image gallery */}
      <ProductImageGallery
        productId={product.id}
        useCase={imageUseCase}
        productName={product.productName}
      />

      {/* 덮어쓰기 확인 — 삭제 확인창과 state 를 공유하지 않는다.
          되돌릴 수 있는 값 수정이므로 `isDangerous` 는 켜지 않는다. */}
      <ConfirmDialog
        isOpen={showOverwriteConfirm}
        title="바코드 덮어쓰기"
        message={`현재 바코드 ${product.barcodeId} 을 사진에서 읽은 값으로 바꿉니다. 스캔 작업이 이 값을 씁니다.`}
        confirmText="덮어쓰기"
        onConfirm={() => runExtract(true)}
        onCancel={() => setShowOverwriteConfirm(false)}
      />

      {/* Delete Confirmation Dialog
          🔴 삭제는 soft delete 다 — 「되돌릴 수 없습니다」는 사실이 아니었다(FEATURE_2609_69 / A). */}
      <ConfirmDialog
        isOpen={showDeleteConfirmation}
        title="물품 삭제"
        message="이 물품을 삭제하면 목록에서 숨겨집니다. 지난 기록은 그대로 남습니다."
        confirmText="삭제"
        isDangerous
        isLoading={isDeleting}
        onConfirm={handleDeleteConfirm}
        onCancel={() => setShowDeleteConfirmation(false)}
      />
    </div>
  );
}

/** 기록 건수 한 줄. 아직 안 실렸거나 0 이면 `-` */
function countText(count: number | undefined, unit: string): string {
  if (count == null || count === 0) return '-';
  return `${count}${unit}`;
}

function RecordRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <span className="text-gray-600">{label}</span>
      <span className="font-medium text-gray-900">{value}</span>
    </div>
  );
}
