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
import { ConfirmDialog } from '@/presentation/components/ui/ConfirmDialog';
import { toast } from '@/infrastructure/stores/toastStore';
import { extractErrorMessage } from '@/infrastructure/utils/errorMessage';
import { ShareActionCell, TargetMetTag, type ShareActions } from './purchaseShareUi';
import { ReceiptDetailModal } from '../../receipts/components/ReceiptDetailModal';

/**
 * Opened content of a product row, <b>shared</b> by the list tab, the 「오늘 넘김」 group and the completed tab
 * (PLAN 2609_29 D21 · FEATURE_2610_09 D67).
 *
 * **Purpose**: ① check-in card ② recent purchases ③ seller shares (「전체」 only, D83) ④ channel chips + lines.
 * **Rule**: do not copy it for one tab — the tabs differ only in which rows they hold and in the date filter.
 * **File**: src/app/dashboard/purchase/list/components/PurchaseGroupDetail.tsx
 *
 * **Usage**:
 * <PurchaseGroupDetail item={item} sellers={sellers} filterSellerId={null} stockLinked={false}
 *                      onRecorded={refresh} shareActions={shareActions} />
 *
 * ⚠️ A check-in is per product × seller (D3) — it never hangs off an order line.
 * ⚠️ The channel chips filter the lines only; the header numbers do not change (D10).
 * ❌ No purchased quantity and no input on an order line (D7). Manual lines (source=MANUAL) are the exception:
 *    quantity (1 or more), [판매자 바꾸기] and [제거] (FEATURE_2610_09 D23 · D24 · D77) — none of them is a purchase.
 */

const PLATFORM_LABEL: Record<string, string> = { COUPANG: '쿠팡', NAVER: '네이버', ELEVENST: '11번가' };

/**
 * Channel = seller × platform. A manual line has no platform → 「{sellerName}/수동」 (FEATURE_2610_09 D17).
 * ⚠️ A platform missing from the map shows its raw code — a new platform never draws an empty label.
 */
export function channelLabel(line: PurchaseListLine): string {
  if (!line.platform) return `${line.sellerName}/수동`;
  return `${line.sellerName}/${PLATFORM_LABEL[line.platform] ?? line.platform}`;
}

/** Chip key: an order line's account, or one manual chip per seller (D17). */
const channelKey = (line: PurchaseListLine) =>
  line.marketplaceAccountId != null ? String(line.marketplaceAccountId) : `MANUAL-${line.sellerId}`;

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

/** The seller field starts at the filter's seller, or the only seller, or empty (D9 · D10 · D53). */
const checkInDefaults = (sellerId: string): CheckInFormData => ({
  sellerId,
  purchasedOn: today(),
  quantity: '1',
  amountMode: 'TOTAL',
  amount: '',
  reflectToBasePrice: true,
});

const SELECT_CLASS =
  'px-2 py-1 border border-gray-300 rounded text-sm bg-white focus:outline-none focus:ring-1 focus:ring-blue-500';

interface PurchaseGroupDetailProps {
  item: PurchaseListItem;
  sellers: Seller[];
  /** Seller filter; null = 「전체」 (D9 default seller · D83 share rows). */
  filterSellerId: number | null;
  /** Stock link setting (D71 ③ — the check-in notice). */
  stockLinked: boolean;
  onRecorded: () => void | Promise<void>;
  shareActions: ShareActions;
}

export function PurchaseGroupDetail({
  item,
  sellers,
  filterSellerId,
  stockLinked,
  onRecorded,
  shareActions,
}: PurchaseGroupDetailProps) {
  const purchaseListUseCase = useMemo(
    () => new PurchaseListUseCase(new PurchaseListRepositoryImpl()),
    []
  );

  // D53: one seller → the seller fields are hidden and that seller is used.
  const soleSeller = sellers.length === 1 ? sellers[0] : null;
  const defaultSellerId =
    filterSellerId != null ? String(filterSellerId) : soleSeller ? String(soleSeller.id) : '';

  const form = useForm<CheckInFormData>({
    resolver: zodResolver(checkInSchema),
    defaultValues: checkInDefaults(defaultSellerId),
  });

  const [isSaving, setIsSaving] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [stockNotice, setStockNotice] = useState('');

  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [historySellerId, setHistorySellerId] = useState('');
  const [records, setRecords] = useState<PurchaseRecord[] | null>(null);
  const [isHistoryLoading, setIsHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState('');
  // FEATURE_2610_18 D93 ①: the receipt opened from a history row's [영수증]; null = closed.
  const [openReceiptId, setOpenReceiptId] = useState<number | null>(null);

  const [activeChannel, setActiveChannel] = useState<string>('ALL');

  const [removeTarget, setRemoveTarget] = useState<PurchaseListLine | null>(null);
  const [isRemoving, setIsRemoving] = useState(false);
  const [pendingLineId, setPendingLineId] = useState<number | null>(null);

  // [제거] deletes the manual line itself (FEATURE_2610_09 D77).
  const removeManualLine = useCallback(async () => {
    if (!removeTarget || isRemoving) return;
    setIsRemoving(true);
    try {
      await purchaseListUseCase.deleteManualItem(removeTarget.itemId);
      toast.success('수동 추가를 제거했습니다.');
      setRemoveTarget(null);
      await onRecorded();
    } catch (err) {
      toast.error(extractErrorMessage(err, '수동 추가를 제거하지 못했습니다.'));
    } finally {
      setIsRemoving(false);
    }
  }, [removeTarget, isRemoving, purchaseListUseCase, onRecorded]);

  const saveManualQty = useCallback(
    async (line: PurchaseListLine, manualQty: number) => {
      setPendingLineId(line.itemId);
      try {
        await purchaseListUseCase.adjustManualQty(line.itemId, { manualQty });
        await onRecorded();
      } catch (err) {
        toast.error(extractErrorMessage(err, '수량을 고치지 못했습니다.'));
      } finally {
        setPendingLineId(null);
      }
    },
    [purchaseListUseCase, onRecorded]
  );

  // D13 · D24 · D26: saved as soon as a seller is picked; a taken seller → the server's 409 text, the line stays.
  const changeManualSeller = useCallback(
    async (line: PurchaseListLine, sellerId: number) => {
      setPendingLineId(line.itemId);
      try {
        await purchaseListUseCase.changeManualSeller(line.itemId, sellerId);
        await onRecorded();
      } catch (err) {
        toast.error(extractErrorMessage(err, '판매자를 바꾸지 못했습니다.'));
      } finally {
        setPendingLineId(null);
      }
    },
    [purchaseListUseCase, onRecorded]
  );

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

  const loadHistory = useCallback(
    async (historySeller: string) => {
      setIsHistoryLoading(true);
      setHistoryError('');
      try {
        setRecords(
          await purchaseListUseCase.getRecentPurchases(
            item.productId,
            RECENT_PURCHASE_LIMIT,
            historySeller ? Number(historySeller) : undefined
          )
        );
      } catch {
        setHistoryError('구매 이력 조회에 실패했습니다.');
      } finally {
        setIsHistoryLoading(false);
      }
    },
    [purchaseListUseCase, item.productId]
  );

  // D25: every opening starts at 「전체」 and loads again; the box's own seller filter is separate from the page's.
  const toggleHistory = useCallback(() => {
    const next = !isHistoryOpen;
    setIsHistoryOpen(next);
    if (next) {
      setHistorySellerId('');
      void loadHistory('');
    }
  }, [isHistoryOpen, loadHistory]);

  const changeHistorySeller = useCallback(
    (value: string) => {
      setHistorySellerId(value);
      void loadHistory(value);
    },
    [loadHistory]
  );

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
          // Always true — the server writes stock only while the stock link is on (FEATURE_2610_09 D65).
          recordStock: true,
        });
        // 음수 정정은 재고를 건드리지 않는다(D17) — 조용히 넘기면 재고가 오른 줄 안다.
        if (stockLinked && !result.stockRecorded) {
          setStockNotice(
            '재고는 반영되지 않았습니다 — 실물이 줄었다면 재고 화면에서 조정하세요'
          );
        }
        form.reset(checkInDefaults(defaultSellerId));
        // 방금 넣은 건이 안 보이면 이상하다 — 이력 캐시를 버린다.
        setRecords(null);
        if (isHistoryOpen) await loadHistory(historySellerId);
        await onRecorded();
      } catch (err) {
        // 금액 검증(총액·단가 동시 입력 등)은 서버가 판정한다 — 메시지를 원문 그대로 보여준다.
        const serverMessage = axios.isAxiosError(err) ? err.response?.data?.message : undefined;
        setSubmitError(serverMessage || '입고 저장에 실패했습니다.');
      } finally {
        setIsSaving(false);
      }
    },
    [
      purchaseListUseCase,
      item.productId,
      form,
      stockLinked,
      defaultSellerId,
      isHistoryOpen,
      historySellerId,
      loadHistory,
      onRecorded,
    ]
  );

  // Chips = the channels that actually appear in this product's lines; manual lines get one chip per seller (D17).
  const channels = useMemo(() => {
    const seen = new Map<string, string>();
    item.lines.forEach((line) => {
      const key = channelKey(line);
      if (!seen.has(key)) seen.set(key, channelLabel(line));
    });
    return Array.from(seen, ([key, label]) => ({ key, label }));
  }, [item.lines]);

  const visibleLines =
    activeChannel === 'ALL'
      ? item.lines
      : item.lines.filter((line) => channelKey(line) === activeChannel);

  return (
    <div className="space-y-4">
      {/* 입고 카드 — 구매 입력은 라인이 아니라 그룹 하나에 모인다(D14) */}
      <form
        onSubmit={form.handleSubmit(submitCheckIn)}
        className="bg-white border border-gray-200 rounded-lg p-4"
      >
        <h3 className="text-sm font-semibold text-gray-900">입고</h3>

        <div className="mt-3 flex flex-wrap items-end gap-2">
          {!soleSeller && (
            <div>
              <label className="block text-xs text-gray-500 mb-1">판매자</label>
              <select {...form.register('sellerId')} className={SELECT_CLASS}>
                <option value="">선택</option>
                {sellers.map((seller) => (
                  <option key={seller.id} value={seller.id}>
                    {seller.sellerName}
                  </option>
                ))}
              </select>
            </div>
          )}
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
            <select {...form.register('amountMode')} className={SELECT_CLASS}>
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
          {/* D71 ③: no stock switch — the stock link setting decides; the notice shows only while it is on. */}
          {stockLinked && <span className="text-xs text-gray-400">입고하면 재고에 바로 더해집니다</span>}

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

        {/* Recent purchases — per product, 「전체」 by default, its own seller filter (D7 · D25). */}
        {isHistoryOpen && (
          <div className="mt-3 border-t border-gray-100 pt-3 space-y-2">
            {!soleSeller && (
              <div className="flex items-center gap-2">
                <label className="text-xs text-gray-500">판매자</label>
                <select
                  value={historySellerId}
                  onChange={(e) => changeHistorySeller(e.target.value)}
                  className={SELECT_CLASS}
                >
                  <option value="">전체</option>
                  {sellers.map((seller) => (
                    <option key={seller.id} value={seller.id}>
                      {seller.sellerName}
                    </option>
                  ))}
                </select>
              </div>
            )}
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
                    {/* A blank amount (null) is not 「0원」 — it reads 「미기입」 (FEATURE_2610_18 D68). */}
                    {record.totalAmount == null ? (
                      <span className="text-gray-400">미기입</span>
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
                    {record.receiptId != null && (
                      <button
                        type="button"
                        onClick={() => setOpenReceiptId(record.receiptId)}
                        className="text-blue-600 hover:underline"
                      >
                        영수증
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </form>

      {/* Seller shares — 「전체」 only; the seller view puts the buttons on the product row (D59 · D83). */}
      {filterSellerId == null && (
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-100 border-b border-gray-200">
              <tr className="text-gray-600">
                <th className="px-4 py-2 text-left font-medium">판매자</th>
                <th className="px-4 py-2 text-right font-medium">필요 수량</th>
                <th className="px-4 py-2 text-right font-medium">매입 완료 수량</th>
                <th className="px-4 py-2 text-right font-medium">매입 필요 수량</th>
                <th className="px-4 py-2 text-right font-medium">처리</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {item.shares.map((share) => (
                <tr key={share.sellerId}>
                  <td className="px-4 py-2 text-gray-700">
                    {share.sellerName}
                    <TargetMetTag share={share} />
                  </td>
                  <td className="px-4 py-2 text-right text-gray-900">{share.neededQty}</td>
                  <td className="px-4 py-2 text-right text-gray-900">{share.purchasedQty}</td>
                  <td className="px-4 py-2 text-right text-gray-900">{share.remainingQty}</td>
                  <td className="px-4 py-2 text-right">
                    <ShareActionCell productId={item.productId} share={share} actions={shareActions} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

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

      {/* Lines — order lines are read-only; a manual line takes quantity · seller · removal (D23 · D24 · D77). */}
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-100 border-b border-gray-200">
            <tr className="text-gray-600">
              <th className="px-4 py-2 text-left font-medium">채널</th>
              <th className="px-4 py-2 text-left font-medium">주문번호</th>
              <th className="px-4 py-2 text-right font-medium">필요 수량</th>
              <th className="px-4 py-2 w-56" aria-label="작업" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {visibleLines.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-gray-400">
                  표시할 주문이 없습니다.
                </td>
              </tr>
            )}
            {visibleLines.map((line) => {
              const isManual = line.source === 'MANUAL' && line.manualQty > 0;
              const busy = pendingLineId === line.itemId;
              return (
                <tr key={line.itemId}>
                  <td className="px-4 py-2 text-gray-700">{channelLabel(line)}</td>
                  <td className="px-4 py-2 text-gray-500">{line.externalOrderId ?? '—'}</td>
                  <td className="px-4 py-2 text-right text-gray-900">
                    {isManual ? (
                      <ManualQtyInput
                        key={`${line.itemId}-${line.manualQty}`}
                        value={line.manualQty}
                        disabled={busy}
                        onSave={(qty) => void saveManualQty(line, qty)}
                      />
                    ) : (
                      line.neededQty
                    )}
                  </td>
                  <td className="px-4 py-2 text-right">
                    {isManual && (
                      <div className="flex items-center justify-end gap-1">
                        {!soleSeller && (
                          <ManualSellerPicker
                            sellers={sellers}
                            currentSellerId={line.sellerId}
                            disabled={busy}
                            onPick={(id) => void changeManualSeller(line, id)}
                          />
                        )}
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => setRemoveTarget(line)}
                          className="px-2 py-0.5 text-xs border border-gray-300 rounded text-red-600 hover:bg-red-50"
                        >
                          제거
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <ConfirmDialog
        isOpen={removeTarget !== null}
        title="수동 추가 제거"
        message={
          removeTarget
            ? `${item.productName} 수동 추가 ${removeTarget.manualQty}개를 구매목록에서 제거합니다. 주문에서 온 수량과 구매 기록은 그대로입니다.`
            : ''
        }
        confirmText="제거"
        onConfirm={removeManualLine}
        onCancel={() => setRemoveTarget(null)}
        isDangerous
        isLoading={isRemoving}
      />

      <ReceiptDetailModal
        receiptId={openReceiptId}
        sellers={sellers}
        onClose={() => setOpenReceiptId(null)}
        onEdited={async () => {
          // D100: the lines moved to another seller or day — reload the history and the list numbers (D2).
          setRecords(null);
          if (isHistoryOpen) await loadHistory(historySellerId);
          await onRecorded();
        }}
      />
    </div>
  );
}

/** Manual quantity — 1 or more; [저장] is enabled once the value is a different whole number ≥ 1 (D23). */
function ManualQtyInput({
  value,
  disabled,
  onSave,
}: {
  value: number;
  disabled: boolean;
  onSave: (qty: number) => void;
}) {
  const [text, setText] = useState(String(value));
  const valid = isIntStr(text) && Number(text) >= 1 && Number(text) !== value;
  return (
    <div className="flex items-center justify-end gap-1">
      <input
        type="number"
        min={1}
        value={text}
        disabled={disabled}
        onChange={(e) => setText(e.target.value)}
        className="w-20 px-2 py-0.5 border border-gray-300 rounded text-sm text-right focus:outline-none focus:ring-1 focus:ring-blue-500"
      />
      <button
        type="button"
        disabled={disabled || !valid}
        onClick={() => onSave(Number(text))}
        className="px-2 py-0.5 text-xs border border-gray-300 rounded text-gray-700 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        저장
      </button>
    </div>
  );
}

/** [판매자 바꾸기] → a seller select (no 「전체」) that saves on pick, [취소] closes it (D13 · D24). */
function ManualSellerPicker({
  sellers,
  currentSellerId,
  disabled,
  onPick,
}: {
  sellers: Seller[];
  currentSellerId: number;
  disabled: boolean;
  onPick: (sellerId: number) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  if (!isOpen) {
    return (
      <button
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen(true)}
        className="px-2 py-0.5 text-xs border border-gray-300 rounded text-gray-700 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        판매자 바꾸기
      </button>
    );
  }
  return (
    <div className="flex items-center gap-1">
      <select
        value=""
        disabled={disabled}
        onChange={(e) => {
          if (e.target.value === '') return;
          setIsOpen(false);
          onPick(Number(e.target.value));
        }}
        className={SELECT_CLASS}
      >
        <option value="">선택</option>
        {sellers
          .filter((seller) => seller.id !== currentSellerId)
          .map((seller) => (
            <option key={seller.id} value={seller.id}>
              {seller.sellerName}
            </option>
          ))}
      </select>
      <button
        type="button"
        onClick={() => setIsOpen(false)}
        className="px-2 py-0.5 text-xs border border-gray-300 rounded text-gray-700 hover:bg-gray-100"
      >
        취소
      </button>
    </div>
  );
}
