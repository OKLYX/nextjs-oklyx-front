'use client';

import { useCallback, useMemo, useState } from 'react';
import axios from 'axios';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { PurchaseListRepositoryImpl } from '@/infrastructure/repositories/PurchaseListRepositoryImpl';
import { PurchaseListUseCase } from '@/application/usecases/PurchaseListUseCase';
import type {
  PurchaseListItem,
  PurchaseListLine,
  PurchaseRecord,
} from '@/domain/entities/PurchaseListEntity';
import type { Seller } from '@/domain/entities/SellerEntity';

/**
 * 구매목록 탭과 구매완료 탭이 <b>같이 쓰는</b> 그룹 토글 내용물 (PLAN 2609_29 D21).
 *
 * **용도**: 그룹(물품)을 펼쳤을 때 보이는 ① 입고 카드 ② 최근 구매이력 ③ 채널 칩 + 주문 줄.
 * **필수 규칙**: 완료탭용으로 복제하지 말 것 — 두 탭의 차이는 그룹 필터와 기간 필터뿐이다.
 * **파일**: src/app/dashboard/purchase/list/components/PurchaseGroupDetail.tsx
 *
 * **사용 예제**:
 * <PurchaseGroupDetail item={item} sellers={sellers} onRecorded={refresh} />
 *
 * ⚠️ 입고는 물품 × 판매자 단위다(D3) — 주문 라인에 붙지 않는다.
 * ⚠️ 채널 칩은 표시 필터일 뿐 헤더 숫자(필요·구매·잔여)를 바꾸지 않는다(D10).
 * ❌ 주문 줄에 구매수량·입력 컨트롤을 두지 않는다(D7).
 */

const PLATFORM_LABEL: Record<string, string> = { COUPANG: '쿠팡', NAVER: '네이버' };

/**
 * 채널 = 판매자 × 플랫폼. 수동 라인은 둘 다 null 이라 '수동'.
 * ⚠️ 매핑에 없는 플랫폼은 원문 그대로 — 새 플랫폼이 붙어도 빈칸이 되지 않는다.
 */
export function channelLabel(line: PurchaseListLine): string {
  if (!line.platform || !line.sellerName) return '수동';
  return `${line.sellerName}/${PLATFORM_LABEL[line.platform] ?? line.platform}`;
}

const RECENT_PURCHASE_LIMIT = 5;

const isIntStr = (v: string) => v.trim() !== '' && Number.isInteger(Number(v));

const checkInSchema = z.object({
  sellerId: z.string().min(1, '판매자를 선택하세요.'),
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
type CheckInFormData = z.infer<typeof checkInSchema>;

// 로컬 타임존 기준 오늘(YYYY-MM-DD). toISOString(UTC)은 KST에서 하루 어긋날 수 있어 직접 조립.
const today = () => {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
};

// 통화 표시는 toLocaleString 하나로 충분하다 — 포맷 라이브러리를 새로 들이지 않는다.
const formatAmount = (v: number) => v.toLocaleString('ko-KR', { maximumFractionDigits: 2 });

const checkInDefaults = (): CheckInFormData => ({
  sellerId: '',
  purchasedOn: today(),
  quantity: '1',
  amountMode: 'TOTAL',
  amount: '',
  reflectToBasePrice: true,
});

interface PurchaseGroupDetailProps {
  item: PurchaseListItem;
  sellers: Seller[];
  onRecorded: () => void | Promise<void>;
}

export function PurchaseGroupDetail({ item, sellers, onRecorded }: PurchaseGroupDetailProps) {
  const purchaseListUseCase = useMemo(
    () => new PurchaseListUseCase(new PurchaseListRepositoryImpl()),
    []
  );

  const form = useForm<CheckInFormData>({
    resolver: zodResolver(checkInSchema),
    defaultValues: checkInDefaults(),
  });

  const [isSaving, setIsSaving] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [stockNotice, setStockNotice] = useState('');

  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [records, setRecords] = useState<PurchaseRecord[] | null>(null);
  const [isHistoryLoading, setIsHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState('');

  const [activeChannel, setActiveChannel] = useState<string>('ALL');

  // watch() 대신 useWatch — watch() 는 React Compiler 메모이제이션을 통째로 끈다.
  const [sellerId, amountMode, amountInput, quantityInput, reflectToBasePrice] = useWatch({
    control: form.control,
    name: ['sellerId', 'amountMode', 'amount', 'quantity', 'reflectToBasePrice'],
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

  const canSubmit =
    sellerId !== '' && isIntStr(quantityInput) && Number(quantityInput) !== 0 && !isSaving;

  const loadHistory = useCallback(async () => {
    setIsHistoryLoading(true);
    setHistoryError('');
    try {
      setRecords(await purchaseListUseCase.getRecentPurchases(item.productId, RECENT_PURCHASE_LIMIT));
    } catch {
      setHistoryError('구매 이력 조회에 실패했습니다.');
    } finally {
      setIsHistoryLoading(false);
    }
  }, [purchaseListUseCase, item.productId]);

  // 한 번 불러온 뒤 접었다 펴면 재호출하지 않는다 — 캐시는 [입고] 성공 때만 버린다.
  const toggleHistory = useCallback(() => {
    const next = !isHistoryOpen;
    setIsHistoryOpen(next);
    if (next && records === null && !isHistoryLoading) loadHistory();
  }, [isHistoryOpen, records, isHistoryLoading, loadHistory]);

  const submitCheckIn = useCallback(
    async (data: CheckInFormData) => {
      setIsSaving(true);
      setSubmitError('');
      setStockNotice('');
      try {
        // 총액/단가는 하나만 실어 보낸다. 빈 금액은 0 이 아니라 "키 없음"이다(PLAN 2609_28 D1).
        const amountNum = data.amount.trim() === '' ? undefined : Number(data.amount);
        const result = await purchaseListUseCase.recordPurchase({
          productId: item.productId,
          sellerId: Number(data.sellerId),
          purchasedOn: data.purchasedOn,
          quantity: Number(data.quantity),
          ...(amountNum !== undefined && data.amountMode === 'TOTAL'
            ? { totalAmount: amountNum }
            : {}),
          ...(amountNum !== undefined && data.amountMode === 'UNIT' ? { unitPrice: amountNum } : {}),
          reflectToBasePrice: data.reflectToBasePrice,
          // 체크박스는 체크 + 비활성이라 항상 true 다(PLAN 2609_29 D19).
          recordStock: true,
        });
        // 음수 정정은 재고를 건드리지 않는다(D17) — 조용히 넘기면 재고가 오른 줄 안다.
        if (!result.stockRecorded) {
          setStockNotice(
            '재고는 반영되지 않았습니다 — 실물이 줄었다면 재고 화면에서 조정하세요'
          );
        }
        form.reset(checkInDefaults());
        // 방금 넣은 건이 안 보이면 이상하다 — 이력 캐시를 버린다.
        setRecords(null);
        if (isHistoryOpen) await loadHistory();
        await onRecorded();
      } catch (err) {
        // 금액 검증(총액·단가 동시 입력 등)은 서버가 판정한다 — 메시지를 원문 그대로 보여준다.
        const serverMessage = axios.isAxiosError(err) ? err.response?.data?.message : undefined;
        setSubmitError(serverMessage || '입고 저장에 실패했습니다.');
      } finally {
        setIsSaving(false);
      }
    },
    [purchaseListUseCase, item.productId, form, isHistoryOpen, loadHistory, onRecorded]
  );

  // 그 그룹에 실제로 등장하는 채널만 칩으로 낸다. 수동 라인은 marketplaceAccountId 가 없어 'MANUAL' 하나로 묶인다.
  const channels = useMemo(() => {
    const seen = new Map<string, string>();
    item.lines.forEach((line) => {
      const key = line.marketplaceAccountId != null ? String(line.marketplaceAccountId) : 'MANUAL';
      if (!seen.has(key)) seen.set(key, channelLabel(line));
    });
    return Array.from(seen, ([key, label]) => ({ key, label }));
  }, [item.lines]);

  const visibleLines =
    activeChannel === 'ALL'
      ? item.lines
      : item.lines.filter(
          (line) =>
            (line.marketplaceAccountId != null ? String(line.marketplaceAccountId) : 'MANUAL') ===
            activeChannel
        );

  return (
    <div className="space-y-4">
      {/* 입고 카드 — 구매 입력은 라인이 아니라 그룹 하나에 모인다(D14) */}
      <form
        onSubmit={form.handleSubmit(submitCheckIn)}
        className="bg-white border border-gray-200 rounded-lg p-4"
      >
        <h3 className="text-sm font-semibold text-gray-900">입고</h3>

        <div className="mt-3 flex flex-wrap items-end gap-2">
          <div>
            <label className="block text-xs text-gray-500 mb-1">판매자</label>
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
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">구매일</label>
            <input
              type="date"
              {...form.register('purchasedOn')}
              className="px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">금액 기준</label>
            <select
              {...form.register('amountMode')}
              className="px-2 py-1 border border-gray-300 rounded text-sm bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="TOTAL">총액</option>
              <option value="UNIT">단가</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">수량(정정 시 음수)</label>
            <input
              type="number"
              {...form.register('quantity')}
              className="w-28 px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
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
                {...form.register('amount')}
                className="w-32 px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
              <span className="text-sm text-gray-500">원</span>
            </div>
          </div>
          {amountPreview && <span className="text-xs text-gray-400 pb-1.5">{amountPreview}</span>}
        </div>

        <div className="mt-3">
          <label className="flex items-center gap-2 text-xs text-gray-600">
            <input
              type="checkbox"
              {...form.register('reflectToBasePrice')}
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

        <div className="mt-2 flex flex-wrap items-center gap-3">
          {/* 재고 즉시 반영: 켠 채로 잠근다(D19) — 끄는 기능은 재고 화면과 함께 열린다 */}
          <label className="flex items-center gap-2 text-xs text-gray-400 cursor-not-allowed">
            <input
              type="checkbox"
              checked
              disabled
              readOnly
              className="h-4 w-4 cursor-not-allowed"
            />
            재고 즉시 반영 <span className="text-gray-400">(입고대기 화면 준비 중)</span>
          </label>

          <div className="ml-auto flex items-center gap-2">
            <button
              type="button"
              onClick={toggleHistory}
              className="px-3 py-1 text-sm border border-gray-300 rounded hover:bg-gray-100"
            >
              최근 구매이력 {isHistoryOpen ? '▲' : '▼'}
            </button>
            <button
              type="submit"
              disabled={!canSubmit}
              className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              {isSaving ? '저장 중...' : '입고'}
            </button>
          </div>
        </div>

        {(form.formState.errors.sellerId ||
          form.formState.errors.quantity ||
          form.formState.errors.purchasedOn ||
          form.formState.errors.amount) && (
          <p className="mt-2 text-xs text-red-600">
            {form.formState.errors.sellerId?.message ||
              form.formState.errors.quantity?.message ||
              form.formState.errors.purchasedOn?.message ||
              form.formState.errors.amount?.message}
          </p>
        )}

        {submitError && <p className="mt-2 text-xs text-red-600">{submitError}</p>}
        {stockNotice && (
          <p className="mt-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1">
            {stockNotice}
          </p>
        )}

        {/* 최근 구매이력 — 물품 기준, 판매자 무관(D9) */}
        {isHistoryOpen && (
          <div className="mt-3 border-t border-gray-100 pt-3">
            {isHistoryLoading && <p className="text-xs text-gray-400">불러오는 중...</p>}
            {!isHistoryLoading && historyError && (
              <p className="text-xs text-red-600">{historyError}</p>
            )}
            {!isHistoryLoading && !historyError && records !== null && records.length === 0 && (
              <p className="text-xs text-gray-400">구매 이력 없음</p>
            )}
            {!isHistoryLoading && !historyError && records !== null && records.length > 0 && (
              <ul className="space-y-1">
                {records.map((record) => (
                  <li key={record.id} className="text-xs text-gray-600 flex flex-wrap gap-3">
                    <span>{record.purchasedOn.slice(5)}</span>
                    <span className="text-gray-800">{record.sellerName}</span>
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
                          <span className="text-gray-400">
                            {' '}
                            (@{formatAmount(record.unitPrice)})
                          </span>
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
        )}
      </form>

      {/* 채널 칩 — 표시 필터일 뿐 헤더 숫자는 그대로다(D10) */}
      <div className="flex flex-wrap gap-2">
        {[{ key: 'ALL', label: '전체' }, ...channels].map((chip) => {
          const isActive = activeChannel === chip.key;
          return (
            <button
              key={chip.key}
              type="button"
              onClick={() => setActiveChannel(chip.key)}
              className={`px-3 py-1 text-xs rounded-full border transition-colors ${
                isActive
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-100'
              }`}
            >
              {chip.label}
            </button>
          );
        })}
      </div>

      {/* 주문 줄 — 읽기 전용. 구매수량도 입력 컨트롤도 없다(D7) */}
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-100 border-b border-gray-200">
            <tr className="text-gray-600">
              <th className="px-4 py-2 text-left font-medium">채널</th>
              <th className="px-4 py-2 text-left font-medium">주문번호</th>
              <th className="px-4 py-2 text-right font-medium">필요</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {visibleLines.length === 0 && (
              <tr>
                <td colSpan={3} className="px-4 py-6 text-center text-gray-400">
                  표시할 주문이 없습니다.
                </td>
              </tr>
            )}
            {visibleLines.map((line) => (
              <tr key={line.itemId}>
                <td className="px-4 py-2 text-gray-700">{channelLabel(line)}</td>
                <td className="px-4 py-2 text-gray-500">{line.externalOrderId ?? '—'}</td>
                <td className="px-4 py-2 text-right text-gray-900">{line.neededQty}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
