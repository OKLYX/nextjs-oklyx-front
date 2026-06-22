'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
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
    defaultValues: { purchasedOn: today(), quantity: '1' },
  });

  const manualForm = useForm<ManualFormData>({
    resolver: zodResolver(manualSchema),
    defaultValues: { manualQty: String(line.manualQty) },
  });

  const [isSavingRecord, setIsSavingRecord] = useState(false);
  const [isSavingManual, setIsSavingManual] = useState(false);

  const submitRecord = async (data: RecordFormData) => {
    setIsSavingRecord(true);
    try {
      await onRecordPurchase(line.itemId, {
        purchasedOn: data.purchasedOn,
        quantity: Number(data.quantity),
      });
      recordForm.reset({ purchasedOn: today(), quantity: '1' });
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
              <li key={record.id} className="text-xs text-gray-600 flex gap-3">
                <span>{record.purchasedOn}</span>
                <span className={record.quantity < 0 ? 'text-red-600' : 'text-gray-800'}>
                  {record.quantity > 0 ? `+${record.quantity}` : record.quantity}
                </span>
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
        {(recordForm.formState.errors.quantity || recordForm.formState.errors.purchasedOn) && (
          <p className="w-full text-xs text-red-600">
            {recordForm.formState.errors.quantity?.message ||
              recordForm.formState.errors.purchasedOn?.message}
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
