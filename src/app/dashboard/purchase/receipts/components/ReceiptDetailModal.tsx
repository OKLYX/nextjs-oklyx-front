'use client';

import { useEffect, useMemo, useState } from 'react';
import { PurchaseReceiptRepositoryImpl } from '@/infrastructure/repositories/PurchaseReceiptRepositoryImpl';
import { PurchaseReceiptUseCase } from '@/application/usecases/PurchaseReceiptUseCase';
import type { ReceiptDetail } from '@/domain/entities/PurchaseReceiptEntity';
import type { Seller } from '@/domain/entities/SellerEntity';
import { resolveThumbUrl } from '@/infrastructure/utils/thumbUrl';
import { Button } from '@/presentation/components/ui/Button';
import { Modal } from '@/presentation/components/ui/Modal';
import { Spinner } from '@/presentation/components/Spinner';
import { DataCard, DataCardSwitch } from '@/presentation/components/DataCard';
import { ReceiptEditModal } from './ReceiptEditModal';

/**
 * Receipt photo + every line of one receipt (FEATURE_2610_18 D93 · D94).
 *
 * **Purpose**: the one receipt view of the web — opened from the receipt list rows and from the [영수증] button of a
 * recent-purchase row on the purchase list. [수정] opens `ReceiptEditModal` (header edit, D100 · D102).
 * **File**: src/app/dashboard/purchase/receipts/components/ReceiptDetailModal.tsx
 *
 * **Usage**:
 * ```tsx
 * const [receiptId, setReceiptId] = useState<number | null>(null);
 * <ReceiptDetailModal receiptId={receiptId} sellers={sellers} onClose={() => setReceiptId(null)} onEdited={reload} />
 * ```
 *
 * ⚠️ `receiptId` null = closed. The modal loads the receipt itself every time `receiptId` changes.
 * ⚠️ After an edit the modal shows the saved receipt and calls `onEdited` — the caller reloads what it shows.
 * ⚠️ The photo is the stored value — it goes through `resolveThumbUrl` (S3 URL as is, local path via the uploads proxy).
 * ❌ Do not copy this modal per screen.
 */
interface ReceiptDetailModalProps {
  receiptId: number | null;
  /** Payer seller choices of the edit form (D100 ② — one seller hides the card and payer fields). */
  sellers: Seller[];
  onClose: () => void;
  /** Called after a header edit is saved. */
  onEdited: () => void | Promise<void>;
}

const formatAmount = (v: number) => v.toLocaleString('ko-KR', { maximumFractionDigits: 2 });

export function ReceiptDetailModal({ receiptId, sellers, onClose, onEdited }: ReceiptDetailModalProps) {
  const useCase = useMemo(() => new PurchaseReceiptUseCase(new PurchaseReceiptRepositoryImpl()), []);
  const [detail, setDetail] = useState<ReceiptDetail | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    if (receiptId == null) return;
    let cancelled = false;
    void (async () => {
      setIsLoading(true);
      setError('');
      setDetail(null);
      setIsEditing(false);
      try {
        const result = await useCase.get(receiptId);
        if (!cancelled) setDetail(result);
      } catch {
        if (!cancelled) setError('영수증을 불러오지 못했습니다.');
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [receiptId, useCase]);

  if (receiptId == null) return null;

  const photoSrc = detail ? resolveThumbUrl(detail.photoUrl) : '';

  return (
    <Modal
      isOpen
      onClose={onClose}
      title="영수증"
      closeOnOverlayClick
      footer={
        detail && (
          <Button variant="secondary" onClick={() => setIsEditing(true)}>
            수정
          </Button>
        )
      }
    >
      {isLoading && <Spinner size={20} label="불러오는 중..." />}
      {!isLoading && error && <p className="text-sm text-red-600">{error}</p>}
      {!isLoading && detail && (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-gray-700">
            <span>{detail.purchasedOn}</span>
            <span>결제 판매자 {detail.payerSellerName}</span>
            <span>카드 {detail.cardAlias ?? '카드 없음'}</span>
          </div>
          <div className="space-y-1">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={photoSrc} alt="영수증 사진" className="max-h-96 w-auto rounded border border-gray-200" />
            <a href={photoSrc} target="_blank" rel="noreferrer" className="text-xs text-blue-600 hover:underline">
              원본 열기
            </a>
          </div>
          <DataCardSwitch
            placement="nested"
            renderCards={() =>
              // Narrow-screen cards (FEATURE_2610_31 D14): the app's receipt line — product name, then
              // 「수량 N · 금액 (@단가)」 with 「 · 기준가 미반영」 (a blank amount reads 「미기입」).
              detail.lines.map((line, index) => (
                <DataCard
                  key={index}
                  body={
                    <div>
                      <p className="text-base text-gray-900">{line.productName}</p>
                      <p className="text-sm text-gray-500">
                        수량 {line.quantity} ·{' '}
                        {line.totalAmount == null
                          ? '미기입'
                          : `${formatAmount(line.totalAmount)}원${
                              line.unitPrice != null ? ` (@${formatAmount(line.unitPrice)})` : ''
                            }`}
                        {line.reflectToBasePrice ? '' : ' · 기준가 미반영'}
                      </p>
                    </div>
                  }
                />
              ))
            }
          >
          <table className="w-full text-sm">
            <thead className="bg-gray-100 border-b border-gray-200">
              <tr className="text-gray-600">
                <th className="px-3 py-2 text-left font-medium">상품</th>
                <th className="px-3 py-2 text-right font-medium">수량</th>
                <th className="px-3 py-2 text-right font-medium">금액</th>
                <th className="px-3 py-2 text-left font-medium">기준가</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {detail.lines.map((line, index) => (
                <tr key={index}>
                  <td className="px-3 py-2 text-gray-800">{line.productName}</td>
                  <td className="px-3 py-2 text-right text-gray-800">{line.quantity}</td>
                  <td className="px-3 py-2 text-right">
                    {/* D68: a blank amount reads 「미기입」, never 「0원」. */}
                    {line.totalAmount == null ? (
                      <span className="text-gray-400">미기입</span>
                    ) : (
                      <span className="text-gray-800">
                        {formatAmount(line.totalAmount)}원
                        {line.unitPrice != null && (
                          <span className="text-gray-400"> (@{formatAmount(line.unitPrice)})</span>
                        )}
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-gray-500">{line.reflectToBasePrice ? '반영' : '미반영'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          </DataCardSwitch>
        </div>
      )}
      <ReceiptEditModal
        detail={isEditing ? detail : null}
        sellers={sellers}
        onClose={() => setIsEditing(false)}
        onSaved={async (updated) => {
          setDetail(updated);
          setIsEditing(false);
          await onEdited();
        }}
      />
    </Modal>
  );
}
