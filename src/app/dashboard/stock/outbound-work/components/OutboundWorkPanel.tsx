'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@/presentation/components/ui/Button';
import { StockLotUseCase } from '@/application/usecases/StockLotUseCase';
import { StockLotRepositoryImpl } from '@/infrastructure/repositories/StockLotRepositoryImpl';
import { StockWorkUseCase } from '@/application/usecases/StockWorkUseCase';
import { StockWorkRepositoryImpl } from '@/infrastructure/repositories/StockWorkRepositoryImpl';
import type { Seller } from '@/domain/entities/SellerEntity';
import {
  OUTBOUND_WORK_DISPOSAL_REASONS,
  STOCK_REASON_LABELS,
  type StockReason,
} from '@/domain/entities/StockEntity';
import { todayKst } from '@/domain/entities/Settlement';
import { toast } from '@/infrastructure/stores/toastStore';
import { extractErrorMessage } from '@/infrastructure/utils/errorMessage';
import { ScanInput } from '@/app/dashboard/stock/packing/components/ScanInput';
import { StockProductThumb } from '@/app/dashboard/stock/components/StockProductThumb';
import { NameText } from '@/presentation/components/NameText';

/**
 * One tab of 「출고 작업」 — 「폐기」 or 「매입처 반품」 (FEATURE_2611_34 D9 ~ D15 · D28 · D33 · D34).
 *
 * - Barcodes come from page-wide keys like 「입고 작업」 (D37); a hidden panel (`active` false) ignores them (R20).
 * - No screen seller yet = nothing is added, 「먼저 판매자를 고르세요」 (D9). One seller = that seller, fixed (R24).
 *   The seller list has real sellers only (D10).
 * - The same barcode adds 1 to the line of that product with the screen seller and reason and moves it to the top,
 *   else a new line at the top (D13 · R24). Date · seller · reason · save sit above the scan bar. A line changed on its own is 「따로 정함」 and stops following the screen values (D11).
 * - 「폐기」 picks a disposal reason (D11 · R13); 「매입처 반품」 always saves SUPPLIER_RETURN and shows no reason (D5).
 * - Unknown barcode = a notice only, no product link or new product (D14).
 * - Save sends every line of this tab in one request (D34); success = toast and empty lines, seller · reason · day
 *   stay (D28 · R22).
 */

interface WorkLine {
  key: number;
  productId: number;
  productName: string;
  /** The product's representative photo as stored; null = none. */
  imageUrl: string | null;
  quantity: string;
  sellerId: string;
  reason: StockReason;
  /** Only used on an ETC line (D12 · R25). */
  reasonNote: string;
  /** 「따로 정함」 — set on the line itself, no longer follows the screen values (D11). */
  custom: boolean;
}

const MODE_TEXT = {
  DISPOSAL: {
    dateLabel: '폐기일',
    saveLabel: '폐기 저장',
    saved: '폐기를 저장했습니다.',
    saveFail: '폐기를 저장하지 못했습니다.',
  },
  SUPPLIER_RETURN: {
    dateLabel: '반품일',
    saveLabel: '매입처 반품 저장',
    saved: '매입처 반품을 저장했습니다.',
    saveFail: '매입처 반품을 저장하지 못했습니다.',
  },
} as const;

const INPUT_CLASS =
  'px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500';

export interface OutboundWorkPanelProps {
  mode: 'DISPOSAL' | 'SUPPLIER_RETURN';
  active: boolean;
  sellers: Seller[];
}

export function OutboundWorkPanel({ mode, active, sellers }: OutboundWorkPanelProps) {
  const lotUseCase = useMemo(() => new StockLotUseCase(new StockLotRepositoryImpl()), []);
  const workUseCase = useMemo(() => new StockWorkUseCase(new StockWorkRepositoryImpl()), []);

  const [buffer, setBuffer] = useState('');
  const [isScanning, setIsScanning] = useState(false);
  const [cart, setCart] = useState<WorkLine[]>([]);
  const [movedOn, setMovedOn] = useState(todayKst());
  const [screenSellerId, setScreenSellerId] = useState('');
  const [screenReason, setScreenReason] = useState<StockReason>(
    mode === 'DISPOSAL' ? 'DAMAGED' : 'SUPPLIER_RETURN'
  );
  const [message, setMessage] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const nextKey = useRef(1);

  // D9 · R24: one seller = that seller, fixed — also for a line scanned before the seller list arrived.
  const soleSeller = sellers.length === 1 ? sellers[0] : null;
  const screenSeller = soleSeller ? String(soleSeller.id) : screenSellerId;
  const lineSeller = (line: WorkLine) => (soleSeller ? String(soleSeller.id) : line.sellerId);

  // D13 · R24: +1 on the line of that product with the screen seller and reason (moved to the top), else a new line
  // with them at the top.
  const addToCart = useCallback(
    (productId: number, productName: string, imageUrl: string | null) => {
      setCart((prev) => {
        const found = prev.find(
          (line) => line.productId === productId && line.sellerId === screenSeller && line.reason === screenReason
        );
        // Newest first: a re-scanned line moves to the top, a new line is added at the top — right under the scan bar.
        if (found) {
          return [
            { ...found, quantity: String(Number(found.quantity || '0') + 1) },
            ...prev.filter((line) => line.key !== found.key),
          ];
        }
        const key = nextKey.current++;
        return [
          {
            key,
            productId,
            productName,
            imageUrl,
            quantity: '1',
            sellerId: screenSeller,
            reason: screenReason,
            reasonNote: '',
            custom: false,
          },
          ...prev,
        ];
      });
    },
    [screenSeller, screenReason]
  );

  // D11 · R25: the lines not set on their own follow the screen values; leaving ETC clears the note.
  const changeScreen = (sellerId: string, reason: StockReason) => {
    setScreenSellerId(sellerId);
    setScreenReason(reason);
    setCart((prev) =>
      prev.map((line) =>
        line.custom ? line : { ...line, sellerId, reason, reasonNote: reason === 'ETC' ? line.reasonNote : '' }
      )
    );
  };

  // D11 · R25: a line changed on its own stops following the screen values; leaving ETC clears the note.
  const changeLine = (key: number, patch: Partial<Pick<WorkLine, 'sellerId' | 'reason'>>) =>
    setCart((prev) =>
      prev.map((line) => {
        if (line.key !== key) return line;
        const next = { ...line, ...patch, custom: true };
        return next.reason === 'ETC' ? next : { ...next, reasonNote: '' };
      })
    );

  const changeLineValue = (key: number, patch: Partial<Pick<WorkLine, 'quantity' | 'reasonNote'>>) =>
    setCart((prev) => prev.map((line) => (line.key === key ? { ...line, ...patch } : line)));

  const lookup = useCallback(
    async (code: string) => {
      const value = code.trim();
      if (!value) return;
      if (screenSeller === '') {
        setMessage('먼저 판매자를 고르세요');
        return;
      }
      setIsScanning(true);
      setMessage('');
      try {
        const result = await lotUseCase.barcode(value);
        if (result.found && result.productId !== null) {
          addToCart(result.productId, result.productName ?? '', result.imageUrl);
          setMessage('');
        } else {
          setMessage(`등록 안 된 바코드: ${value}`);
        }
      } catch (err) {
        setMessage(extractErrorMessage(err, '바코드를 찾지 못했습니다.'));
      } finally {
        setIsScanning(false);
      }
    },
    [lotUseCase, addToCart, screenSeller]
  );

  // Page-wide key capture (same rule as 「입고 작업」): a focused input keeps its keys; a hidden panel ignores them.
  const handlersRef = useRef({ lookup, buffer, busy: false, active: true });
  useEffect(() => {
    handlersRef.current = { lookup, buffer, busy: isScanning || isSaving, active };
  });
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const tag = (event.target as HTMLElement | null)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      const handlers = handlersRef.current;
      if (!handlers.active) return;
      if (handlers.busy) return;
      if (event.key === 'Enter') {
        event.preventDefault();
        const code = handlers.buffer;
        setBuffer('');
        void handlers.lookup(code);
        return;
      }
      if (event.key === 'Backspace') {
        event.preventDefault();
        setBuffer((prev) => prev.slice(0, -1));
        return;
      }
      if (event.key.length === 1) {
        event.preventDefault();
        setBuffer((prev) => prev + event.key);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const save = async () => {
    const invalid = cart.find((line) => !Number.isInteger(Number(line.quantity)) || Number(line.quantity) < 1);
    if (invalid) {
      setMessage('수량은 1 이상 정수만 입력할 수 있습니다.');
      return;
    }
    // D12: an ETC line without a note stops the whole save.
    const etcWithoutNote = cart.filter((line) => line.reason === 'ETC' && line.reasonNote.trim() === '');
    if (etcWithoutNote.length > 0) {
      setMessage(`기타 사유는 설명을 입력해야 합니다: ${etcWithoutNote.map((line) => line.productName).join(', ')}`);
      return;
    }
    setIsSaving(true);
    setMessage('');
    try {
      await workUseCase.outboundWork({
        movedOn,
        lines: cart.map((line) => ({
          productId: line.productId,
          sellerId: Number(lineSeller(line)),
          reason: line.reason,
          ...(line.reason === 'ETC' ? { reasonNote: line.reasonNote.trim() } : {}),
          quantity: Number(line.quantity),
        })),
      });
      toast.success(MODE_TEXT[mode].saved);
      setCart([]);
      setMessage('');
    } catch (err) {
      setMessage(extractErrorMessage(err, MODE_TEXT[mode].saveFail));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className={active ? 'space-y-4' : 'hidden'}>
      {/* Date · seller · reason · save sit above the scan bar — the seller is picked before any scan. */}
      <div className="bg-white rounded-lg shadow p-4 flex flex-wrap items-end gap-2">
        <div>
          <label className="block text-xs text-gray-500 mb-1">{MODE_TEXT[mode].dateLabel}</label>
          <input type="date" value={movedOn} onChange={(e) => setMovedOn(e.target.value)} className={INPUT_CLASS} />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">판매자</label>
          {soleSeller ? (
            <p className="py-1 text-sm text-gray-700">{soleSeller.sellerName}</p>
          ) : (
            <select
              value={screenSellerId}
              onChange={(e) => changeScreen(e.target.value, screenReason)}
              className={INPUT_CLASS}
            >
              <option value="" disabled>
                판매자를 고르세요
              </option>
              {sellers.map((seller) => (
                <option key={seller.id} value={seller.id}>
                  {seller.sellerName}
                </option>
              ))}
            </select>
          )}
        </div>
        {mode === 'DISPOSAL' && (
          <div>
            <label className="block text-xs text-gray-500 mb-1">사유</label>
            <select
              value={screenReason}
              onChange={(e) => changeScreen(screenSeller, e.target.value as StockReason)}
              className={INPUT_CLASS}
            >
              {OUTBOUND_WORK_DISPOSAL_REASONS.map((reason) => (
                <option key={reason} value={reason}>
                  {STOCK_REASON_LABELS[reason]}
                </option>
              ))}
            </select>
          </div>
        )}
        <Button onClick={save} disabled={cart.length === 0} isLoading={isSaving} loadingText="저장 중...">
          {MODE_TEXT[mode].saveLabel}
        </Button>
      </div>

      <ScanInput mode="ITEM" buffer={buffer} disabled={isSaving} isScanning={isScanning} />

      {message && (
        <div className="p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">{message}</div>
      )}

      <div className="bg-white rounded-lg shadow p-4 space-y-3">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-gray-500">
              <th className="py-2">상품</th>
              <th className="py-2 w-40">판매자</th>
              {mode === 'DISPOSAL' && <th className="py-2 w-56">사유</th>}
              <th className="py-2 w-32">수량</th>
              <th className="py-2 w-20" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {cart.length === 0 && (
              <tr>
                <td colSpan={mode === 'DISPOSAL' ? 5 : 4} className="py-6 text-center text-gray-500">
                  바코드를 스캔하면 여기에 담깁니다.
                </td>
              </tr>
            )}
            {cart.map((line) => (
              <tr key={line.key}>
                <td className="py-2 text-gray-900">
                  <div className="flex items-center gap-2">
                    <StockProductThumb imageUrl={line.imageUrl} productId={line.productId} alt={line.productName} />
                    <span className="flex items-start gap-2">
                      <NameText kind="product" name={line.productName} inTable expandable />
                      {line.custom && <span className="shrink-0 text-xs text-amber-700">따로 정함</span>}
                    </span>
                  </div>
                </td>
                <td className="py-2">
                  {soleSeller ? (
                    <span className="text-gray-700">{soleSeller.sellerName}</span>
                  ) : (
                    <select
                      value={line.sellerId}
                      onChange={(e) => changeLine(line.key, { sellerId: e.target.value })}
                      className={INPUT_CLASS}
                    >
                      {sellers.map((seller) => (
                        <option key={seller.id} value={seller.id}>
                          {seller.sellerName}
                        </option>
                      ))}
                    </select>
                  )}
                </td>
                {mode === 'DISPOSAL' && (
                  <td className="py-2">
                    <div className="space-y-1">
                      <select
                        value={line.reason}
                        onChange={(e) => changeLine(line.key, { reason: e.target.value as StockReason })}
                        className={INPUT_CLASS}
                      >
                        {OUTBOUND_WORK_DISPOSAL_REASONS.map((reason) => (
                          <option key={reason} value={reason}>
                            {STOCK_REASON_LABELS[reason]}
                          </option>
                        ))}
                      </select>
                      {line.reason === 'ETC' && (
                        <input
                          value={line.reasonNote}
                          placeholder="기타 설명"
                          onChange={(e) => changeLineValue(line.key, { reasonNote: e.target.value })}
                          className={`${INPUT_CLASS} block`}
                        />
                      )}
                    </div>
                  </td>
                )}
                <td className="py-2">
                  <input
                    type="number"
                    min={1}
                    value={line.quantity}
                    onChange={(e) => changeLineValue(line.key, { quantity: e.target.value })}
                    className={`${INPUT_CLASS} w-24`}
                  />
                </td>
                <td className="py-2 text-right">
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => setCart((prev) => prev.filter((l) => l.key !== line.key))}
                  >
                    빼기
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
