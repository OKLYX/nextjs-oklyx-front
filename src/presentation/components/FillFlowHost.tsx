'use client';

import { useEffect, useMemo, useState } from 'react';
import { StockLotUseCase } from '@/application/usecases/StockLotUseCase';
import { StockLotRepositoryImpl } from '@/infrastructure/repositories/StockLotRepositoryImpl';
import { useFillFlowStore } from '@/infrastructure/stores/fillFlowStore';
import { toast } from '@/infrastructure/stores/toastStore';
import { extractErrorMessage } from '@/infrastructure/utils/errorMessage';
import {
  fillLotLabel,
  fillWindowHead,
  monthDayText,
  type FillCandidate,
} from '@/domain/entities/StockLotEntity';
import { Button } from '@/presentation/components/ui/Button';
import { Modal } from '@/presentation/components/ui/Modal';

/**
 * The 「채울까요?」 windows after an intake save (FEATURE_2611_22 D3 ① · D19 · D23 · D27 · D30 ~ D32 · D39).
 * File: src/presentation/components/FillFlowHost.tsx
 *
 * **Required rules**
 * - Mounted **once**, in `dashboard/layout.tsx`. Screens do not mount it — an intake save calls `openFillFlow`.
 * - One window per product of the save, in save order; a product without an order outbound row to fill has none.
 *
 * **Behaviour**
 * - Head = `fillWindowHead(rowCount, emptyQuantity)`; one part per saved lot of that product (`fillLotLabel`), each row
 *   with a check, 「주문번호」 · 「출고 날짜」 · 「판매자」 · 「빈 개수」 and 「채울 개수」. The checks and counts start as
 *   the server sent them (D23 · D32); checking a row starts its count at its empty pieces.
 * - [채우기] saves this product only (the checked rows of each part); a refusal stays in the window with the server
 *   text, a success shows the next product. [건너뛰기] shows the next product. ✕ closes every window left (D39).
 *
 * ❌ No `fixed inset-0` · `z-50` · `z-[60]` — the window is a `ui/Modal`.
 */

const FORM_ID = 'fill-flow-form';

interface Draft {
  checked: boolean;
  quantity: string;
}

const draftKey = (lotId: number, movementId: number) => `${lotId}:${movementId}`;

function initialDrafts(window: FillCandidate): Record<string, Draft> {
  const drafts: Record<string, Draft> = {};
  window.lots.forEach((lot) =>
    lot.rows.forEach((row) => {
      drafts[draftKey(lot.lotId, row.movementId)] = {
        checked: row.checkedQuantity > 0,
        quantity: String(row.checkedQuantity > 0 ? row.checkedQuantity : row.emptyQuantity),
      };
    })
  );
  return drafts;
}

export function FillFlowHost() {
  const lotUseCase = useMemo(() => new StockLotUseCase(new StockLotRepositoryImpl()), []);
  const lotIds = useFillFlowStore((s) => s.lotIds);
  const close = useFillFlowStore((s) => s.close);
  const [windows, setWindows] = useState<FillCandidate[]>([]);
  const [index, setIndex] = useState(0);
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Inline async IIFE defers setState past the sync effect body (set-state-in-effect lint).
  useEffect(() => {
    if (lotIds === null) return;
    void (async () => {
      setWindows([]);
      setIndex(0);
      setError('');
      try {
        const loaded = await lotUseCase.fillCandidates(lotIds);
        if (loaded.length === 0) {
          close();
          return;
        }
        setWindows(loaded);
        setDrafts(initialDrafts(loaded[0]));
      } catch (err) {
        toast.error(extractErrorMessage(err, '채울 출고를 불러오지 못했습니다.'));
        close();
      }
    })();
  }, [lotIds, lotUseCase, close]);

  const current = lotIds !== null ? windows[index] : undefined;
  if (!current) return null;

  const next = () => {
    setError('');
    if (index + 1 >= windows.length) {
      close();
      return;
    }
    setIndex(index + 1);
    setDrafts(initialDrafts(windows[index + 1]));
  };

  const setDraft = (key: string, change: Partial<Draft>) =>
    setDrafts((prev) => ({ ...prev, [key]: { ...prev[key], ...change } }));

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const fills = current.lots
      .map((lot) => ({
        lotId: lot.lotId,
        lines: lot.rows
          .filter((row) => drafts[draftKey(lot.lotId, row.movementId)]?.checked)
          .map((row) => ({
            movementId: row.movementId,
            quantity: Number(drafts[draftKey(lot.lotId, row.movementId)].quantity),
          })),
      }))
      .filter((fill) => fill.lines.length > 0);
    setError('');
    setIsSubmitting(true);
    try {
      await lotUseCase.fill({ fills });
      next();
    } catch (err) {
      setError(extractErrorMessage(err, '채우지 못했습니다.'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen
      onClose={close}
      title={current.productName}
      disableClose={isSubmitting}
      footer={
        <>
          <Button variant="secondary" onClick={next} disabled={isSubmitting}>
            건너뛰기
          </Button>
          <Button type="submit" form={FORM_ID} isLoading={isSubmitting} loadingText="저장 중...">
            채우기
          </Button>
        </>
      }
    >
      <form id={FORM_ID} onSubmit={(e) => void submit(e)} className="space-y-4">
        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">{error}</div>
        )}
        <p className="text-sm text-gray-900">{fillWindowHead(current.rowCount, current.emptyQuantity)}</p>
        {current.lots.map((lot) => (
          <div key={lot.lotId} className="space-y-2">
            <p className="text-sm font-medium text-gray-700">{fillLotLabel(lot.movedOn, lot.sellerName, lot.quantity)}</p>
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50">
                <tr className="text-left text-gray-500">
                  <th className="px-2 py-1 w-8" />
                  <th className="px-2 py-1">주문번호</th>
                  <th className="px-2 py-1">출고 날짜</th>
                  <th className="px-2 py-1">판매자</th>
                  <th className="px-2 py-1 text-right">빈 개수</th>
                  <th className="px-2 py-1 text-right">채울 개수</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {lot.rows.map((row) => {
                  const key = draftKey(lot.lotId, row.movementId);
                  const draft = drafts[key];
                  return (
                    <tr key={key}>
                      <td className="px-2 py-1">
                        <input
                          type="checkbox"
                          checked={draft?.checked ?? false}
                          onChange={(e) =>
                            setDraft(key, {
                              checked: e.target.checked,
                              ...(e.target.checked ? { quantity: String(row.emptyQuantity) } : {}),
                            })
                          }
                          disabled={isSubmitting}
                          className="h-4 w-4 accent-blue-600"
                        />
                      </td>
                      <td className="px-2 py-1 text-gray-900">{row.orderNumber}</td>
                      <td className="px-2 py-1 text-gray-700">{monthDayText(row.movedOn)}</td>
                      <td className="px-2 py-1 text-gray-700">{row.sellerName}</td>
                      <td className="px-2 py-1 text-right text-gray-900">{row.emptyQuantity}</td>
                      <td className="px-2 py-1 text-right">
                        <input
                          type="number"
                          min={1}
                          value={draft?.quantity ?? ''}
                          onChange={(e) => setDraft(key, { quantity: e.target.value })}
                          disabled={isSubmitting || !(draft?.checked ?? false)}
                          className="w-20 px-2 py-1 border border-gray-300 rounded text-sm text-right focus:outline-none focus:ring-1 focus:ring-blue-500"
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ))}
      </form>
    </Modal>
  );
}
