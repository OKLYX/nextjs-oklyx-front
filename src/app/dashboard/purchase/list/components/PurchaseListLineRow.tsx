'use client';

import { useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import type { PurchaseListLine } from '@/domain/entities/PurchaseListEntity';
import type { RecordPurchaseRequest } from '@/application/dto/PurchaseListDTOs';

const isIntStr = (v: string) => v.trim() !== '' && Number.isInteger(Number(v));

const recordSchema = z.object({
  purchasedOn: z.string().min(1, '구매 날짜는 필수입니다.'),
  // 정정 시 음수 허용. 0은 무의미하므로 제외.
  quantity: z
    .string()
    .refine(isIntStr, '정수만 입력 가능합니다.')
    .refine((v) => Number(v) !== 0, '0은 입력할 수 없습니다.'),
  // 총액/단가 중 어느 쪽을 입력했는지. 나머지 한쪽은 서버가 계산한다(PLAN 2609_28 D2).
  amountMode: z.enum(['TOTAL', 'UNIT']),
  // 빈 문자열 허용 — 금액을 모르는 채 "샀다"만 기록하는 경로를 남긴다.
  amount: z
    .string()
    .refine(
      (v) => v.trim() === '' || (!Number.isNaN(Number(v)) && Number(v) >= 0),
      '금액은 0 이상의 숫자여야 합니다.'
    ),
  reflectToBasePrice: z.boolean(),
});
type RecordFormData = z.infer<typeof recordSchema>;

const manualSchema = z.object({
  manualQty: z
    .string()
    .refine(isIntStr, '정수만 입력 가능합니다.')
    .refine((v) => Number(v) >= 0, '0 이상이어야 합니다.'),
});
type ManualFormData = z.infer<typeof manualSchema>;

const today = () => new Date().toISOString().slice(0, 10);

// 통화 표시는 toLocaleString 하나로 충분하다 — 포맷 라이브러리를 새로 들이지 않는다.
const formatAmount = (v: number) => v.toLocaleString('ko-KR', { maximumFractionDigits: 2 });

const recordDefaults = (): RecordFormData => ({
  purchasedOn: today(),
  quantity: '1',
  amountMode: 'TOTAL',
  amount: '',
  reflectToBasePrice: true,
});

interface PurchaseListLineRowProps {
  line: PurchaseListLine;
  onRecordPurchase: (itemId: number, request: RecordPurchaseRequest) => Promise<void>;
  onAdjustManual: (itemId: number, manualQty: number) => Promise<void>;
}

export function PurchaseListLineRow({
  line,
  onRecordPurchase,
  onAdjustManual,
}: PurchaseListLineRowProps) {
  const isManual = line.source === 'MANUAL';
  const neededQty = line.autoQty + line.manualQty;

  const recordForm = useForm<RecordFormData>({
    resolver: zodResolver(recordSchema),
    defaultValues: recordDefaults(),
  });

  const manualForm = useForm<ManualFormData>({
    resolver: zodResolver(manualSchema),
    defaultValues: { manualQty: String(line.manualQty) },
  });

  const [isSavingRecord, setIsSavingRecord] = useState(false);
  const [isSavingManual, setIsSavingManual] = useState(false);

  // watch() 대신 useWatch — watch() 는 React Compiler 메모이제이션을 통째로 끈다.
  const [amountMode, amountInput, quantityInput, reflectToBasePrice] = useWatch({
    control: recordForm.control,
    name: ['amountMode', 'amount', 'quantity', 'reflectToBasePrice'],
  });

  // 표시용 환산값. ⚠️ 전송하지 않는다 — 반올림 주체는 서버 하나다(PLAN 2609_28 D1).
  const amountNumber = amountInput.trim() === '' ? NaN : Number(amountInput);
  const quantityNumber = Number(quantityInput);
  const amountPreview =
    !Number.isFinite(amountNumber) || !Number.isFinite(quantityNumber) || quantityNumber === 0
      ? null
      : amountMode === 'TOTAL'
        ? `단가 ${formatAmount(amountNumber / quantityNumber)}원`
        : `총액 ${formatAmount(amountNumber * quantityNumber)}원`;

  const submitRecord = async (data: RecordFormData) => {
    setIsSavingRecord(true);
    try {
      // 총액/단가는 하나만 실어 보낸다. 빈 금액은 0 이 아니라 "키 없음"이다(PLAN 2609_28 D1).
      const amountNum = data.amount.trim() === '' ? undefined : Number(data.amount);
      await onRecordPurchase(line.itemId, {
        purchasedOn: data.purchasedOn,
        quantity: Number(data.quantity),
        ...(amountNum !== undefined && data.amountMode === 'TOTAL' ? { totalAmount: amountNum } : {}),
        ...(amountNum !== undefined && data.amountMode === 'UNIT' ? { unitPrice: amountNum } : {}),
        reflectToBasePrice: data.reflectToBasePrice,
      });
      recordForm.reset(recordDefaults());
    } catch {
      // 에러는 상위(Container) 배너에서 표시
    } finally {
      setIsSavingRecord(false);
    }
  };

  const submitManual = async (data: ManualFormData) => {
    setIsSavingManual(true);
    try {
      await onAdjustManual(line.itemId, Number(data.manualQty));
    } catch {
      // 상위 배너에서 표시
    } finally {
      setIsSavingManual(false);
    }
  };

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span
          className={`px-2 py-0.5 rounded text-xs font-medium ${
            isManual ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'
          }`}
        >
          {isManual ? '수동' : '주문'}
        </span>
        {line.externalOrderId && (
          <span className="text-gray-500">주문번호 {line.externalOrderId}</span>
        )}
        <span className="ml-auto text-gray-600">
          필요 <b className="text-gray-900">{neededQty}</b>
          <span className="text-gray-400"> (자동 {line.autoQty} + 수동 {line.manualQty})</span>
          {' · '}구매 <b className="text-gray-900">{line.purchasedQty}</b>
        </span>
      </div>

      {/* 구매 이력 */}
      <div className="mt-3">
        {line.records.length === 0 ? (
          <p className="text-xs text-gray-400">구매 이력 없음</p>
        ) : (
          <ul className="space-y-1">
            {line.records.map((record) => (
              <li key={record.id} className="text-xs text-gray-600 flex flex-wrap gap-3">
                <span>{record.purchasedOn}</span>
                <span className={record.quantity < 0 ? 'text-red-600' : 'text-gray-800'}>
                  {record.quantity > 0 ? `+${record.quantity}` : record.quantity}
                </span>
                {/* 금액 미상(null)과 0원은 다르다 — 0원으로 표시하지 않는다 */}
                {record.totalAmount == null ? (
                  <span className="text-gray-400">금액 미상</span>
                ) : (
                  <span className={record.totalAmount < 0 ? 'text-red-600' : 'text-gray-800'}>
                    {formatAmount(record.totalAmount)}원
                    {record.unitPrice != null && (
                      <span className="text-gray-400"> (@{formatAmount(record.unitPrice)})</span>
                    )}
                  </span>
                )}
                {!record.reflectToBasePrice && (
                  <span className="text-gray-400">· 기준가 미반영</span>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* 구매 기록 입력 (라인 단위) */}
      <form
        onSubmit={recordForm.handleSubmit(submitRecord)}
        className="mt-3 flex flex-wrap items-end gap-2"
      >
        <div>
          <label className="block text-xs text-gray-500 mb-1">구매일</label>
          <input
            type="date"
            {...recordForm.register('purchasedOn')}
            className="px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">수량(정정 시 음수)</label>
          <input
            type="number"
            {...recordForm.register('quantity')}
            className="w-28 px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>
        <button
          type="submit"
          disabled={isSavingRecord}
          className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-400"
        >
          {isSavingRecord ? '저장 중...' : '구매 기록'}
        </button>
        {/* 금액 입력 — 폭이 좁아 새 줄로 내린다 */}
        <div className="w-full flex flex-wrap items-end gap-2">
          <div>
            <label className="block text-xs text-gray-500 mb-1">금액 기준</label>
            <select
              {...recordForm.register('amountMode')}
              className="px-2 py-1 border border-gray-300 rounded text-sm bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="TOTAL">총액</option>
              <option value="UNIT">단가</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">
              {amountMode === 'TOTAL' ? '총액' : '단가'}
            </label>
            <div className="flex items-center gap-1">
              <input
                type="text"
                inputMode="decimal"
                placeholder={amountMode === 'TOTAL' ? '영수증 총액' : '개당 단가'}
                {...recordForm.register('amount')}
                className="w-32 px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
              <span className="text-sm text-gray-500">원</span>
            </div>
          </div>
          {amountPreview && <span className="text-xs text-gray-400 pb-1.5">{amountPreview}</span>}
        </div>

        <div className="w-full">
          <label className="flex items-center gap-2 text-xs text-gray-600">
            <input
              type="checkbox"
              {...recordForm.register('reflectToBasePrice')}
              className="h-4 w-4 accent-blue-600"
            />
            상품 기준가에 반영
          </label>
          {!reflectToBasePrice && (
            <p className="mt-1 text-xs text-gray-400">
              이번 매입가는 손익에만 쓰이고 판매가에는 반영되지 않습니다
            </p>
          )}
        </div>

        {(recordForm.formState.errors.quantity ||
          recordForm.formState.errors.purchasedOn ||
          recordForm.formState.errors.amount) && (
          <p className="w-full text-xs text-red-600">
            {recordForm.formState.errors.quantity?.message ||
              recordForm.formState.errors.purchasedOn?.message ||
              recordForm.formState.errors.amount?.message}
          </p>
        )}
      </form>

      {/* 수동수량 교체 (절대값) */}
      <form
        onSubmit={manualForm.handleSubmit(submitManual)}
        className="mt-2 flex flex-wrap items-end gap-2"
      >
        <div>
          <label className="block text-xs text-gray-500 mb-1">수동수량 교체</label>
          <input
            type="number"
            {...manualForm.register('manualQty')}
            className="w-28 px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>
        <button
          type="submit"
          disabled={isSavingManual}
          className="px-3 py-1 text-sm border border-gray-300 rounded hover:bg-gray-100 disabled:opacity-50"
        >
          {isSavingManual ? '변경 중...' : '수량 교체'}
        </button>
        {manualForm.formState.errors.manualQty && (
          <p className="w-full text-xs text-red-600">
            {manualForm.formState.errors.manualQty.message}
          </p>
        )}
      </form>
    </div>
  );
}
