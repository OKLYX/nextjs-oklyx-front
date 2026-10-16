'use client';

import { useEffect, useState } from 'react';
import { Spinner } from '@/presentation/components/Spinner';
import { Button } from '@/presentation/components/ui/Button';
import { ConfirmDialog } from '@/presentation/components/ui/ConfirmDialog';
import type { OrderUseCase } from '@/application/usecases/OrderUseCase';
import type { ElevenstDeliveryLine } from '@/application/dto/OrderDTOs';
import type { CarrierOption, ManualShipmentSplit } from '@/application/dto/ShippingLabelDTOs';

/**
 * 「일부 줄만 보내기」 (1636) and 「한 줄을 송장 여러 장으로」 (6791) of an 11st delivery in preparing
 * (FEATURE_2610_17 / D64).
 *
 * **Purpose**: builds the inputs of the two modes; the order detail sends them through the single-shipment endpoint
 * and shows the result in its own result area (this component never calls the shipment use case).
 * **File**: src/app/dashboard/orders/components/ElevenstSplitShipmentForm.tsx
 *
 * ⚠️ `PARTIAL`: only lines still in preparing get a checkbox (none checked at first); the delivery needs two or more
 * lines; add-on lines alone are blocked with 「추가구성 상품만 따로 보낼 수 없습니다.」; a confirm carries the
 * buyer-consent line.
 * ⚠️ `SPLIT`: one line with quantity 2 or more; 2~10 invoice rows; the quantities must add up to the line's order
 * quantity — otherwise 「송장별 수량의 합이 주문 수량({n}개)과 같아야 합니다.」.
 * ❌ Not for Coupang orders (Coupang keeps the one-invoice form).
 *
 * @example
 * <ElevenstSplitShipmentForm mode="PARTIAL" orderItemId={order.id} orderUseCase={orderUseCase}
 *   carrierOptions={carrierOptions} isLocked={isLocked} isSending={isSubmitting}
 *   onSubmit={handleElevenstModeSubmit} />
 */
export interface ElevenstSplitSubmit {
  carrierCode: string;
  invoiceNumber: string;
  orderItemIds: number[];
  splits?: ManualShipmentSplit[];
}

interface ElevenstSplitShipmentFormProps {
  mode: 'PARTIAL' | 'SPLIT';
  orderItemId: number;
  orderUseCase: OrderUseCase;
  /** The 11st carrier list the order detail already loaded. */
  carrierOptions: CarrierOption[];
  /** Sending or already sent — the inputs are locked (same lock as the one-invoice form). */
  isLocked: boolean;
  /** The order detail is sending this request — the button shows the spinner. */
  isSending: boolean;
  onSubmit: (submit: ElevenstSplitSubmit) => void;
}

const MIN_SPLITS = 2;
const MAX_SPLITS = 10;
const ADD_ON_ONLY_MESSAGE = '추가구성 상품만 따로 보낼 수 없습니다.';
const NEEDS_TWO_MESSAGE = '일부 줄만 보내기는 주문 줄이 2개 이상인 배송건에서만 할 수 있습니다';

interface SplitRow {
  invoiceNumber: string;
  quantity: string;
}

const emptyRows = (): SplitRow[] => [{ invoiceNumber: '', quantity: '' }, { invoiceNumber: '', quantity: '' }];

export function ElevenstSplitShipmentForm({
  mode,
  orderItemId,
  orderUseCase,
  carrierOptions,
  isLocked,
  isSending,
  onSubmit,
}: ElevenstSplitShipmentFormProps) {
  const [lines, setLines] = useState<ElevenstDeliveryLine[]>([]);
  const [loadFailed, setLoadFailed] = useState(false);
  const [checkedIds, setCheckedIds] = useState<number[]>([]);
  const [splitLineId, setSplitLineId] = useState<number | null>(null);
  const [rows, setRows] = useState<SplitRow[]>(emptyRows());
  const [carrierCode, setCarrierCode] = useState('');
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [confirmOpen, setConfirmOpen] = useState(false);

  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        const loaded = await orderUseCase.getElevenstDeliveryLines(orderItemId);
        if (alive) {
          setLines(loaded);
          setLoadFailed(false);
        }
      } catch {
        if (alive) setLoadFailed(true);
      }
    })();
    return () => { alive = false; };
  }, [orderItemId, orderUseCase]);

  const openLines = lines.filter((line) => line.status === 'PREPARING');

  if (loadFailed) return <p className="mt-4 text-sm text-gray-500">주문 줄을 불러오지 못했습니다.</p>;

  const carrierSelect = (
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
  );

  if (mode === 'PARTIAL') {
    const chosen = openLines.filter((line) => checkedIds.includes(line.orderItemId));
    const addOnOnly = chosen.length > 0 && chosen.every((line) => line.addOn);
    const needsTwo = lines.length < 2;
    const isReady = !isLocked && !needsTwo && chosen.length > 0 && !addOnOnly && carrierCode !== ''
      && invoiceNumber.trim() !== '';
    const toggle = (id: number) =>
      setCheckedIds((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]));
    return (
      <div className="mt-4 flex flex-col gap-3">
        {needsTwo && lines.length > 0 && <p className="text-sm text-gray-500">{NEEDS_TWO_MESSAGE}</p>}
        <ul className="flex flex-col gap-2">
          {openLines.map((line) => (
            <li key={line.orderItemId}>
              <label className="flex items-center gap-2 text-sm text-gray-800">
                <input
                  type="checkbox"
                  checked={checkedIds.includes(line.orderItemId)}
                  onChange={() => toggle(line.orderItemId)}
                  disabled={isLocked || needsTwo}
                />
                {line.itemName ?? '-'} · {line.orderQty}개
              </label>
            </li>
          ))}
        </ul>
        {addOnOnly && <p className="text-sm text-red-600">{ADD_ON_ONLY_MESSAGE}</p>}
        <div className="flex flex-wrap items-center gap-3">
          {carrierSelect}
          <input
            type="text"
            maxLength={50}
            placeholder="송장번호"
            value={invoiceNumber}
            onChange={(e) => setInvoiceNumber(e.target.value)}
            disabled={isLocked}
            className="w-56 px-3 py-2 border border-gray-300 rounded-lg text-sm disabled:bg-gray-100"
          />
          <Button variant="primary" disabled={!isReady} onClick={() => setConfirmOpen(true)}>
            {isSending ? <Spinner label="전송 중..." /> : '발송처리'}
          </Button>
        </div>
        <ConfirmDialog
          isOpen={confirmOpen}
          nested
          title="일부 줄만 보내기"
          message={`구매자 동의를 받은 뒤 보내세요. 고른 ${chosen.length}줄만 발송처리되고 나머지는 배송준비중으로 남습니다.`}
          confirmText="발송처리"
          onConfirm={() => {
            setConfirmOpen(false);
            onSubmit({ carrierCode, invoiceNumber: invoiceNumber.trim(),
              orderItemIds: chosen.map((line) => line.orderItemId) });
          }}
          onCancel={() => setConfirmOpen(false)}
        />
      </div>
    );
  }

  const splittable = openLines.filter((line) => line.orderQty >= 2);
  const target = splittable.find((line) => line.orderItemId === splitLineId) ?? null;
  const quantities = rows.map((row) => Number(row.quantity));
  const sum = quantities.reduce((total, quantity) => total + (Number.isInteger(quantity) ? quantity : 0), 0);
  const rowsFilled = rows.every((row, index) =>
    row.invoiceNumber.trim() !== '' && Number.isInteger(quantities[index]) && quantities[index] >= 1);
  const sumInvalid = target != null && rowsFilled && sum !== target.orderQty;
  const isReady = !isLocked && target != null && carrierCode !== '' && rowsFilled && !sumInvalid;
  const updateRow = (index: number, patch: Partial<SplitRow>) =>
    setRows((current) => current.map((row, i) => (i === index ? { ...row, ...patch } : row)));

  return (
    <div className="mt-4 flex flex-col gap-3">
      <ul className="flex flex-col gap-2">
        {splittable.map((line) => (
          <li key={line.orderItemId}>
            <label className="flex items-center gap-2 text-sm text-gray-800">
              <input
                type="radio"
                name="splitLine"
                checked={splitLineId === line.orderItemId}
                onChange={() => setSplitLineId(line.orderItemId)}
                disabled={isLocked}
              />
              {line.itemName ?? '-'} · {line.orderQty}개
            </label>
          </li>
        ))}
      </ul>
      <div>{carrierSelect}</div>
      {rows.map((row, index) => (
        <div key={index} className="flex flex-wrap items-center gap-3">
          <input
            type="text"
            maxLength={50}
            placeholder="송장번호"
            value={row.invoiceNumber}
            onChange={(e) => updateRow(index, { invoiceNumber: e.target.value })}
            disabled={isLocked}
            className="w-56 px-3 py-2 border border-gray-300 rounded-lg text-sm disabled:bg-gray-100"
          />
          <input
            type="number"
            min={1}
            placeholder="수량"
            value={row.quantity}
            onChange={(e) => updateRow(index, { quantity: e.target.value })}
            disabled={isLocked}
            className="w-24 px-3 py-2 border border-gray-300 rounded-lg text-sm text-right disabled:bg-gray-100"
          />
          {rows.length > MIN_SPLITS && (
            <Button variant="secondary" size="sm" disabled={isLocked}
              onClick={() => setRows((current) => current.filter((_, i) => i !== index))}>
              삭제
            </Button>
          )}
        </div>
      ))}
      <div>
        <Button variant="secondary" size="sm" disabled={isLocked || rows.length >= MAX_SPLITS}
          onClick={() => setRows((current) => [...current, { invoiceNumber: '', quantity: '' }])}>
          송장 줄 추가
        </Button>
      </div>
      {sumInvalid && target != null && (
        <p className="text-sm text-red-600">송장별 수량의 합이 주문 수량({target.orderQty}개)과 같아야 합니다.</p>
      )}
      <div>
        <Button
          variant="primary"
          disabled={!isReady}
          onClick={() => {
            if (target == null) return;
            const splits = rows.map((row, index) => ({ invoiceNumber: row.invoiceNumber.trim(),
              quantity: quantities[index] }));
            onSubmit({ carrierCode, invoiceNumber: splits[0].invoiceNumber, orderItemIds: [target.orderItemId],
              splits });
          }}
        >
          {isSending ? <Spinner label="전송 중..." /> : '발송처리'}
        </Button>
      </div>
    </div>
  );
}
