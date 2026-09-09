'use client';

import { useMemo, useState } from 'react';
import axios from 'axios';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { StockRepositoryImpl } from '@/infrastructure/repositories/StockRepositoryImpl';
import { StockUseCase } from '@/application/usecases/StockUseCase';
import type { Seller } from '@/domain/entities/SellerEntity';
import type { RecordableMovementType, StockReason } from '@/domain/entities/StockEntity';
import {
  REASONS_BY_TYPE,
  RECORDABLE_MOVEMENT_TYPES,
  STOCK_MOVEMENT_TYPE_LABELS,
  STOCK_REASON_LABELS,
} from '@/domain/entities/StockEntity';
import { ProductPicker } from './ProductPicker';

/**
 * 후보 목록(입고 대기 · 반품 대기)이 폼을 채울 때 쓰는 값.
 * `key` 는 같은 후보를 다시 눌러도 useEffect 가 돌게 하는 토큰이다.
 */
export interface MovementPrefill {
  key: number;
  movementType: RecordableMovementType;
  reason?: StockReason;
  productId?: number;
  productName?: string;
  sellerId?: number;
  quantity?: number;
  purchaseRecordId?: number;
  purchaseRecordLabel?: string;
  orderClaimId?: number;
  orderClaimLabel?: string;
}

const isIntStr = (v: string) => v.trim() !== '' && Number.isInteger(Number(v));

const schema = z
  .object({
    movementType: z.enum(['STOCK_IN', 'RETURN_IN', 'DISPOSAL', 'ADJUST']),
    sellerId: z.string(),
    productId: z.string().min(1, '상품을 선택하세요.'),
    productName: z.string(),
    quantity: z.string().refine(isIntStr, '정수만 입력 가능합니다.'),
    reason: z.string(),
    reasonNote: z.string(),
    unitPrice: z.string(),
    purchaseRecordId: z.string(),
    purchaseRecordLabel: z.string(),
    orderClaimId: z.string(),
    orderClaimLabel: z.string(),
    movedOn: z.string().min(1, '날짜는 필수입니다.'),
  })
  .superRefine((data, ctx) => {
    const quantity = Number(data.quantity);
    // 조정만 음수를 허용한다(실사 차이는 방향이 둘이다). 폐기의 부호는 서버가 뒤집는다.
    if (data.movementType === 'ADJUST') {
      if (quantity === 0) {
        ctx.addIssue({ code: 'custom', path: ['quantity'], message: '0은 입력할 수 없습니다.' });
      }
    } else if (quantity <= 0) {
      ctx.addIssue({ code: 'custom', path: ['quantity'], message: '수량은 0보다 커야 합니다.' });
    }
    // 반품입고의 판매자는 서버가 클레임에서 유도한다 — 나머지 유형만 화면이 고른다.
    if (data.movementType !== 'RETURN_IN' && data.sellerId === '') {
      ctx.addIssue({ code: 'custom', path: ['sellerId'], message: '판매자를 선택하세요.' });
    }
  });

type FormData = z.infer<typeof schema>;

// 로컬 타임존 기준 오늘(YYYY-MM-DD). toISOString(UTC)은 KST에서 하루 어긋날 수 있어 직접 조립.
const today = () => {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
};

/**
 * 폼 초기값. 후보 목록에서 넘어온 `prefill` 이 있으면 그 값으로 시작한다.
 *
 * ⚠️ 프리필은 `useEffect` + `reset` 이 아니라 부모의 `key` remount 로 적용한다 —
 * 이 프로젝트 lint 는 effect 안의 동기 setState 를 error 로 막는다.
 */
const defaults = (prefill?: MovementPrefill | null): FormData => ({
  movementType: prefill?.movementType ?? 'STOCK_IN',
  sellerId: prefill?.sellerId != null ? String(prefill.sellerId) : '',
  productId: prefill?.productId != null ? String(prefill.productId) : '',
  productName: prefill?.productName ?? '',
  quantity: prefill?.quantity != null ? String(prefill.quantity) : '1',
  reason: prefill?.reason ?? '',
  reasonNote: '',
  unitPrice: '',
  purchaseRecordId: prefill?.purchaseRecordId != null ? String(prefill.purchaseRecordId) : '',
  purchaseRecordLabel: prefill?.purchaseRecordLabel ?? '',
  orderClaimId: prefill?.orderClaimId != null ? String(prefill.orderClaimId) : '',
  orderClaimLabel: prefill?.orderClaimLabel ?? '',
  movedOn: today(),
});

interface StockInOutFormProps {
  sellers: Seller[];
  prefill: MovementPrefill | null;
  onRecorded: () => void | Promise<void>;
}

/**
 * 입고 · 반품입고 · 폐기 · 조정 기록 폼 (FEATURE_2609_28 / PLAN D6~D10).
 *
 * ⚠️ 출고(STOCK_OUT)는 여기 없다 — 출고는 주문에서 출발한다(D11, `/dashboard/stock/outbound`).
 * ⚠️ 수량은 항상 양수로 보낸다. 폐기의 −n 은 서버가 만든다 — 화면이 부호를 뒤집지 않는다.
 * ⚠️ 유형을 바꾸면 사유·단가·참조를 초기화한다. 남아 있으면 조합 규칙에 걸려 서버 400 이 난다.
 */
export function StockInOutForm({ sellers, prefill, onRecorded }: StockInOutFormProps) {
  const stockUseCase = useMemo(() => new StockUseCase(new StockRepositoryImpl()), []);

  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: defaults(prefill),
  });

  const [isSaving, setIsSaving] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  // watch() 대신 useWatch — watch() 는 React Compiler 메모이제이션을 통째로 끈다.
  const [movementType, reason, productId, productName, purchaseRecordLabel, orderClaimLabel] =
    useWatch({
      control: form.control,
      name: [
        'movementType',
        'reason',
        'productId',
        'productName',
        'purchaseRecordLabel',
        'orderClaimLabel',
      ],
    });

  const reasons = REASONS_BY_TYPE[movementType];

  const handleTypeChange = (next: RecordableMovementType) => {
    // 사유는 유형에 매인 값이다 — 이전 선택을 남기면 서버가 조합을 거부한다.
    form.reset({
      ...defaults(),
      movementType: next,
      sellerId: form.getValues('sellerId'),
      productId: form.getValues('productId'),
      productName: form.getValues('productName'),
      movedOn: form.getValues('movedOn'),
    });
    setSubmitError('');
  };

  const submit = async (data: FormData) => {
    setIsSaving(true);
    setSubmitError('');
    setSuccessMessage('');
    try {
      const movement = await stockUseCase.recordMovement({
        productId: Number(data.productId),
        ...(data.sellerId !== '' ? { sellerId: Number(data.sellerId) } : {}),
        movementType: data.movementType,
        quantity: Number(data.quantity),
        ...(data.reason !== '' ? { reason: data.reason as StockReason } : {}),
        ...(data.reasonNote.trim() !== '' ? { reasonNote: data.reasonNote.trim() } : {}),
        ...(data.unitPrice.trim() !== '' ? { unitPrice: Number(data.unitPrice) } : {}),
        ...(data.orderClaimId !== '' ? { orderClaimId: Number(data.orderClaimId) } : {}),
        ...(data.purchaseRecordId !== ''
          ? { purchaseRecordId: Number(data.purchaseRecordId) }
          : {}),
        movedOn: data.movedOn,
      });
      setSuccessMessage(
        `${STOCK_MOVEMENT_TYPE_LABELS[movement.movementType]} ${movement.quantity} 기록됨 — ${movement.productName} / ${movement.sellerName}`
      );
      form.reset({ ...defaults(), movedOn: data.movedOn });
      await onRecorded();
    } catch (err) {
      // 조합 규칙(사유·단가·참조)의 주인은 서버다 — 메시지를 번역하지 않고 원문 그대로 보여준다.
      const serverMessage = axios.isAxiosError(err) ? err.response?.data?.message : undefined;
      setSubmitError(serverMessage || '재고 기록에 실패했습니다.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <form onSubmit={form.handleSubmit(submit)} className="p-6 space-y-4">
      <h2 className="text-lg font-semibold text-gray-900">입고 · 조정</h2>

      <div className="flex flex-wrap items-start gap-4">
        <div>
          <label className="block text-xs text-gray-500 mb-1">유형</label>
          <select
            value={movementType}
            onChange={(e) => handleTypeChange(e.target.value as RecordableMovementType)}
            className="px-2 py-1 border border-gray-300 rounded text-sm bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            {RECORDABLE_MOVEMENT_TYPES.map((type) => (
              <option key={type} value={type}>
                {STOCK_MOVEMENT_TYPE_LABELS[type]}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs text-gray-500 mb-1">
            판매자{movementType === 'RETURN_IN' && ' (반품 건에서 유도)'}
          </label>
          <select
            {...form.register('sellerId')}
            className="px-2 py-1 border border-gray-300 rounded text-sm bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="">선택</option>
            {sellers.map((seller) => (
              <option key={seller.id} value={seller.id}>
                {seller.sellerName}
              </option>
            ))}
          </select>
          {form.formState.errors.sellerId && (
            <p className="mt-1 text-xs text-red-600">{form.formState.errors.sellerId.message}</p>
          )}
        </div>

        <div>
          <label className="block text-xs text-gray-500 mb-1">상품</label>
          <ProductPicker
            productId={productId === '' ? null : Number(productId)}
            productName={productName}
            onSelect={(id, name) => {
              form.setValue('productId', String(id));
              form.setValue('productName', name);
            }}
            onClear={() => {
              form.setValue('productId', '');
              form.setValue('productName', '');
            }}
            disabled={isSaving}
          />
          {form.formState.errors.productId && (
            <p className="mt-1 text-xs text-red-600">{form.formState.errors.productId.message}</p>
          )}
        </div>

        <div>
          <label className="block text-xs text-gray-500 mb-1">
            수량{movementType === 'ADJUST' && ' (음수 허용)'}
          </label>
          <input
            {...form.register('quantity')}
            type="number"
            className="w-24 px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
          {form.formState.errors.quantity && (
            <p className="mt-1 text-xs text-red-600">{form.formState.errors.quantity.message}</p>
          )}
        </div>

        <div>
          <label className="block text-xs text-gray-500 mb-1">사유</label>
          <select
            {...form.register('reason')}
            disabled={reasons.length === 0}
            className="px-2 py-1 border border-gray-300 rounded text-sm bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-gray-100 disabled:text-gray-400"
          >
            <option value="">{reasons.length === 0 ? '해당 없음' : '선택'}</option>
            {reasons.map((value) => (
              <option key={value} value={value}>
                {STOCK_REASON_LABELS[value]}
              </option>
            ))}
          </select>
        </div>

        {reason === 'ETC' && (
          <div>
            <label className="block text-xs text-gray-500 mb-1">메모</label>
            <input
              {...form.register('reasonNote')}
              type="text"
              placeholder="기타 사유 설명"
              className="px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
        )}

        {reason === 'OPENING' && (
          <div>
            <label className="block text-xs text-gray-500 mb-1">단가</label>
            <input
              {...form.register('unitPrice')}
              type="number"
              step="0.01"
              className="w-28 px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
        )}

        <div>
          <label className="block text-xs text-gray-500 mb-1">날짜</label>
          <input
            {...form.register('movedOn')}
            type="date"
            className="px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>

        <div className="self-end">
          <button
            type="submit"
            disabled={isSaving}
            className="px-4 py-1.5 bg-blue-600 text-white text-sm font-semibold rounded hover:bg-blue-700 disabled:bg-gray-400"
          >
            {isSaving ? '기록 중...' : '기록'}
          </button>
        </div>
      </div>

      {purchaseRecordLabel && (
        <div className="flex items-center gap-2 text-sm text-gray-700">
          <span className="px-2 py-1 bg-blue-50 border border-blue-200 rounded">
            구매기록 {purchaseRecordLabel}
          </span>
          <button
            type="button"
            onClick={() => {
              form.setValue('purchaseRecordId', '');
              form.setValue('purchaseRecordLabel', '');
            }}
            className="text-xs text-gray-500 hover:text-gray-700 underline"
          >
            해제
          </button>
        </div>
      )}

      {orderClaimLabel && (
        <div className="flex items-center gap-2 text-sm text-gray-700">
          <span className="px-2 py-1 bg-blue-50 border border-blue-200 rounded">
            반품 건 {orderClaimLabel}
          </span>
          <button
            type="button"
            onClick={() => {
              form.setValue('orderClaimId', '');
              form.setValue('orderClaimLabel', '');
            }}
            className="text-xs text-gray-500 hover:text-gray-700 underline"
          >
            해제
          </button>
        </div>
      )}

      {movementType === 'STOCK_IN' && reason === 'PURCHASE' && !purchaseRecordLabel && (
        <p className="text-xs text-gray-500">
          아래 <b>입고 대기</b> 목록에서 구매기록을 선택하세요.
        </p>
      )}
      {movementType === 'RETURN_IN' && !orderClaimLabel && (
        <p className="text-xs text-gray-500">
          아래 <b>반품 대기</b> 목록에서 반품 건을 선택하세요.
        </p>
      )}

      {submitError && (
        <div className="p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
          {submitError}
        </div>
      )}
      {successMessage && (
        <div className="p-3 bg-green-50 border border-green-200 rounded text-green-700 text-sm">
          {successMessage}
        </div>
      )}
    </form>
  );
}
