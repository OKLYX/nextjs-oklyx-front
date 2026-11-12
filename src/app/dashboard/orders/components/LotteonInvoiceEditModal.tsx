'use client';

import { useEffect, useState } from 'react';
import axios from 'axios';
import { Spinner } from '@/presentation/components/Spinner';
import { Button } from '@/presentation/components/ui/Button';
import { Modal } from '@/presentation/components/ui/Modal';
import type { OrderUseCase } from '@/application/usecases/OrderUseCase';
import type { ShippingLabelUseCase } from '@/application/usecases/ShippingLabelUseCase';
import type { LotteonInvoiceRecord, LotteonInvoiceRecords } from '@/application/dto/OrderDTOs';
import type { CarrierOption, ManualShipmentResult } from '@/application/dto/ShippingLabelDTOs';
import { extractErrorMessage } from '@/infrastructure/utils/errorMessage';

/**
 * 「송장 수정」 window of a shipped LotteON order (FEATURE_2611_23 / D19 ⑥ · R52).
 *
 * **Purpose**: shows every product of the delivery with its LotteON shipping records, lets the user tick the
 * records to fix and sends one new carrier + invoice for all of them through the single-shipment endpoint
 * (`records`). Each record gets its own result next to it.
 * **File**: src/app/dashboard/orders/components/LotteonInvoiceEditModal.tsx
 *
 * ⚠️ Only records in status 13 · 14 · 15 can be ticked; at open all of them are ticked (D19 ⑥-8 · ⑥-10).
 * ⚠️ A 200 locks the inputs and keeps the window open; `onChanged()` fires once when `succeeded` > 0.
 * ⚠️ The parent renders it conditionally — closing unmounts it, so a reopened window starts fresh.
 * ⚠️ Record times are KST wall-clock strings, cut as text — never turned into a Date.
 * ❌ Do not use it for Coupang or 11st orders.
 *
 * @example
 * {isLotteonEditOpen && (
 *   <LotteonInvoiceEditModal orderItemId={order.id} externalOrderId={order.externalOrderId}
 *     carrierOptions={carrierOptions} useCase={useCase} orderUseCase={orderUseCase}
 *     onChanged={() => setReservationChanged(true)} onClose={() => setIsLotteonEditOpen(false)} />
 * )}
 */
interface LotteonInvoiceEditModalProps {
  orderItemId: number;
  externalOrderId: string;
  /** The LotteON carrier list the order detail already loaded. */
  carrierOptions: CarrierOption[];
  useCase: ShippingLabelUseCase;
  orderUseCase: OrderUseCase;
  /** Called once after a 200 with at least one succeeded record. */
  onChanged: () => void;
  onClose: () => void;
}

const PICKABLE_STATUS = ['13', '14', '15'];

/** 'yyyy-MM-ddTHH:mm:ss' → 'MM/dd HH:mm' by cutting the text; null → '-'. */
function recordTimeText(value: string | null): string {
  if (value == null || value.length < 16) return '-';
  return `${value.slice(5, 7)}/${value.slice(8, 10)} ${value.slice(11, 16)}`;
}

function isPickable(record: LotteonInvoiceRecord): boolean {
  return PICKABLE_STATUS.includes(record.statusCode);
}

const recordKey = (orderItemId: number, procSeq: string) => `${orderItemId}:${procSeq}`;

export function LotteonInvoiceEditModal({
  orderItemId,
  externalOrderId,
  carrierOptions,
  useCase,
  orderUseCase,
  onChanged,
  onClose,
}: LotteonInvoiceEditModalProps) {
  const [products, setProducts] = useState<LotteonInvoiceRecords[]>([]);
  const [loadError, setLoadError] = useState('');
  const [checkedKeys, setCheckedKeys] = useState<string[]>([]);
  const [carrierCode, setCarrierCode] = useState('');
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [sentInvoice, setSentInvoice] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [result, setResult] = useState<ManualShipmentResult | null>(null);
  const [submitError, setSubmitError] = useState('');

  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        const loaded = await orderUseCase.getLotteonInvoiceRecords(orderItemId);
        if (alive) {
          setProducts(loaded);
          setCheckedKeys(loaded.flatMap((product) => product.records
            .filter(isPickable)
            .map((record) => recordKey(product.orderItemId, record.procSeq))));
          setLoadError('');
        }
      } catch (err) {
        if (alive) setLoadError(extractErrorMessage(err, '발송 기록을 불러오지 못했습니다.'));
      }
    })();
    return () => { alive = false; };
  }, [orderItemId, orderUseCase]);

  const isLocked = isSending || result != null;
  const trimmedInvoice = invoiceNumber.trim();
  const isReady = checkedKeys.length > 0 && carrierCode !== '' && trimmedInvoice !== '' && !isLocked;

  const toggle = (key: string) =>
    setCheckedKeys((keys) => (keys.includes(key) ? keys.filter((k) => k !== key) : [...keys, key]));

  const send = async () => {
    const records = products.flatMap((product) => product.records
      .filter((record) => isPickable(record) && checkedKeys.includes(recordKey(product.orderItemId, record.procSeq)))
      .map((record) => ({ orderItemId: product.orderItemId, procSeq: record.procSeq })));
    try {
      setIsSending(true);
      setSubmitError('');
      setSentInvoice(trimmedInvoice);
      const response = await useCase.confirmManualShipment({
        orderItemId,
        deliveryCompanyCode: carrierCode,
        invoiceNumber: trimmedInvoice,
        records,
      });
      setResult(response);
      if (response.succeeded > 0) onChanged();
    } catch (err) {
      // The request never landed — no lock, so the user can try again (R52).
      const serverMessage =
        axios.isAxiosError(err) && err.response?.status === 400
          ? (err.response.data as { message?: string } | undefined)?.message
          : undefined;
      setSubmitError(serverMessage ?? '송장 수정에 실패했습니다. 다시 시도해주세요.');
    } finally {
      setIsSending(false);
    }
  };

  const outcomes = result?.records ?? [];
  const outcomeText = (productId: number, procSeq: string): string | null => {
    const outcome = outcomes.find((o) => o.orderItemId === productId && o.procSeq === procSeq);
    if (outcome == null) return null;
    return outcome.succeeded ? `✅ ${sentInvoice}으로 수정됨` : `❌ ${outcome.message ?? ''}`;
  };

  return (
    <Modal
      isOpen
      nested
      onClose={onClose}
      title="송장 수정"
      disableClose={isSending}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={isSending}>취소</Button>
          <Button variant="primary" onClick={() => void send()} disabled={!isReady}>
            {isSending ? <Spinner label="전송 중..." /> : '수정'}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <p className="text-sm text-gray-700">주문 {externalOrderId}</p>
        <div className="flex flex-wrap items-center gap-3">
          <select
            value={carrierCode}
            onChange={(e) => setCarrierCode(e.target.value)}
            disabled={isLocked}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm disabled:bg-gray-100"
          >
            <option value="">택배사 선택</option>
            {carrierOptions.map((option) => (
              <option key={option.deliveryCompanyCode} value={option.deliveryCompanyCode}>{option.carrierName}</option>
            ))}
          </select>
          <input
            type="text"
            maxLength={50}
            placeholder="새 송장"
            value={invoiceNumber}
            onChange={(e) => { setInvoiceNumber(e.target.value); setSubmitError(''); }}
            disabled={isLocked}
            className="w-56 px-3 py-2 border border-gray-300 rounded-lg text-sm disabled:bg-gray-100"
          />
        </div>

        {loadError && <p className="text-sm text-red-600">{loadError}</p>}

        <ul className="flex flex-col gap-3">
          {products.map((product) => (
            <li key={product.orderItemId}>
              <p className="text-sm font-semibold text-gray-900">{product.productName}</p>
              {product.records.length === 0 ? (
                <p className="mt-1 text-sm text-gray-500">롯데ON 에 발송 기록이 없어 고칠 수 없습니다.</p>
              ) : (
                <ul className="mt-1 flex flex-col gap-1">
                  {product.records.map((record) => {
                    const key = recordKey(product.orderItemId, record.procSeq);
                    const pickable = isPickable(record);
                    const outcome = outcomeText(product.orderItemId, record.procSeq);
                    return (
                      <li key={key} className="flex flex-wrap items-center gap-2 text-sm">
                        <label className={`flex items-center gap-2 ${pickable ? 'text-gray-800' : 'text-gray-400'}`}>
                          <input
                            type="checkbox"
                            checked={pickable && checkedKeys.includes(key)}
                            onChange={() => toggle(key)}
                            disabled={!pickable || isLocked}
                          />
                          {record.invoiceNumber ?? '송장 없음'} · {record.carrierName ?? '-'} · {record.statusName} · {recordTimeText(record.statusAt)}
                        </label>
                        {outcome != null && <span className="text-gray-700">{outcome}</span>}
                      </li>
                    );
                  })}
                </ul>
              )}
            </li>
          ))}
        </ul>

        {submitError && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-red-800 text-sm">{submitError}</div>
        )}
      </div>
    </Modal>
  );
}
