'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@/presentation/components/ui/Button';
import { ConfirmDialog } from '@/presentation/components/ui/ConfirmDialog';
import { StockWorkUseCase } from '@/application/usecases/StockWorkUseCase';
import { StockWorkRepositoryImpl } from '@/infrastructure/repositories/StockWorkRepositoryImpl';
import {
  CLAIM_WORK_TEXT,
  claimItemKey,
  type ClaimWork,
  type ClaimWorkKind,
  type ShippedOrder,
} from '@/domain/entities/StockWorkEntity';
import { todayKst } from '@/domain/entities/Settlement';
import { toast } from '@/infrastructure/stores/toastStore';
import { extractErrorMessage } from '@/infrastructure/utils/errorMessage';
import { ScanInput } from '@/app/dashboard/stock/packing/components/ScanInput';
import { ClaimWorkCard } from '@/app/dashboard/stock/components/ClaimWorkCard';
import { ShippedOrderTable } from '@/app/dashboard/stock/components/ShippedOrderTable';
import { OpenExchangeTable } from '@/app/dashboard/stock/components/OpenExchangeTable';

/**
 * Claim work tab — 「입고 작업」 「반품 재입고」 (`kind="RETURN_IN"`) and 「출고 작업」 「교환 발송」 (`kind="EXCHANGE_SHIP"`)
 * (FEATURE_2611_34 D16 ~ D33 · D38 · D41 · D42).
 *
 * **Purpose**: open the claims of one invoice, match scanned product barcodes to them on the screen, and save the
 * entered quantities as return-in or exchange-ship ledger lines.
 * **File**: `src/app/dashboard/stock/components/ClaimWorkPanel.tsx`
 * **Used by**: `IntakeContainer` (「반품 재입고」) · `OutboundWorkContainer` (「교환 발송」).
 *
 * **Example**:
 * ```tsx
 * <ClaimWorkPanel kind="RETURN_IN" active={tab === 'RETURN_IN'} />
 * <ClaimWorkPanel kind="EXCHANGE_SHIP" active={tab === 'EXCHANGE_SHIP'} />
 * ```
 *
 * - Barcodes come from page-wide keys (D37); a hidden panel (`active` false) ignores them and stays mounted (R20).
 * - 「송장 대기」 (`phase` INVOICE): Enter looks up the invoice. 「담는 중」 (`phase` ITEM): Enter matches the barcode to
 *   the opened claims in server order, no request (D22 · R16).
 * - Saving sends only the cells above 0 (D20); success = toast, back to the invoice wait (R22).
 *
 * ⚠️ All words come from `CLAIM_WORK_TEXT[kind]` — the two tabs differ only there and in the endpoints.
 * ❌ No seller or reason field on these tabs (D23 · D41). ❌ Do not filter claims by status (D19).
 * ❌ No 「채울까요?」 flow after saving (D28).
 */
export interface ClaimWorkPanelProps {
  kind: ClaimWorkKind;
  active: boolean;
}

const INPUT_CLASS =
  'px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500';

const LIST_FAIL = '목록을 불러오지 못했습니다.';

export function ClaimWorkPanel({ kind, active }: ClaimWorkPanelProps) {
  const text = CLAIM_WORK_TEXT[kind];
  const workUseCase = useMemo(() => new StockWorkUseCase(new StockWorkRepositoryImpl()), []);

  const [buffer, setBuffer] = useState('');
  const [isScanning, setIsScanning] = useState(false);
  const [phase, setPhase] = useState<'INVOICE' | 'ITEM'>('INVOICE');
  const [noInvoice, setNoInvoice] = useState(false);
  const [claims, setClaims] = useState<ClaimWork[]>([]);
  const [entered, setEntered] = useState<Record<string, string>>({});
  const [movedOn, setMovedOn] = useState(todayKst());
  const [message, setMessage] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [orders, setOrders] = useState<ShippedOrder[]>([]);
  const [exchanges, setExchanges] = useState<ClaimWork[]>([]);
  const [isListLoading, setIsListLoading] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  // R17: nothing to load = D31 words; everything already done = the 「all done」 words; both stay on the invoice wait.
  const openClaims = useCallback(
    (list: ClaimWork[]) => {
      const loadable = list.filter((claim) => claim.failure === null);
      if (loadable.length === 0) {
        setMessage(text.unknownItems);
        return;
      }
      if (loadable.every((claim) => claim.items.every((item) => item.remainingQty === 0))) {
        setMessage(text.allDone);
        return;
      }
      setPhase('ITEM');
      setClaims(list);
      setEntered({});
      setMessage('');
    },
    [text]
  );

  const lookupInvoice = useCallback(
    async (code: string) => {
      const value = code.trim();
      if (!value) return;
      setIsScanning(true);
      setMessage('');
      try {
        const list =
          kind === 'EXCHANGE_SHIP'
            ? await workUseCase.byReshipInvoice(value)
            : noInvoice
              ? await workUseCase.byParcelInvoice(value)
              : await workUseCase.byReturnInvoice(value);
        openClaims(list);
      } catch (err) {
        setMessage(extractErrorMessage(err, text.lookupFail));
      } finally {
        setIsScanning(false);
      }
    },
    [kind, noInvoice, workUseCase, openClaims, text]
  );

  // R16: the first (claim · product) of the barcode, in server order, that still has room gets +1.
  const scanItem = useCallback(
    (code: string) => {
      const value = code.trim();
      if (!value) return;
      const cells = claims
        .filter((claim) => claim.failure === null)
        .flatMap((claim) =>
          claim.items
            .filter((item) => item.barcode === value)
            .map((item) => ({ key: claimItemKey(claim.orderClaimId, item.productId), item }))
        );
      if (cells.length === 0) {
        setMessage(text.notInClaim + value);
        return;
      }
      const open = cells.find((cell) => Number(entered[cell.key] || '0') < cell.item.remainingQty);
      if (!open) {
        setMessage(`${cells[0].item.productName}은 더 받을 수 없습니다(남은 0개)`);
        return;
      }
      setEntered((prev) => ({ ...prev, [open.key]: String(Number(prev[open.key] || '0') + 1) }));
      setMessage('');
    },
    [claims, entered, text]
  );

  const handleEnter = useCallback(
    (code: string) => {
      if (phase === 'INVOICE') {
        void lookupInvoice(code);
      } else {
        scanItem(code);
      }
    },
    [phase, lookupInvoice, scanItem]
  );

  // Page-wide key capture (same rule as 「입고 작업」): a focused input keeps its keys; a hidden panel ignores them.
  const handlersRef = useRef({ handleEnter, buffer, busy: false, active });
  useEffect(() => {
    handlersRef.current = { handleEnter, buffer, busy: isScanning || isSaving, active };
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
        handlers.handleEnter(code);
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

  const loadExchanges = useCallback(async () => {
    setIsListLoading(true);
    try {
      setExchanges(await workUseCase.openExchanges());
    } catch (err) {
      setMessage(extractErrorMessage(err, LIST_FAIL));
    } finally {
      setIsListLoading(false);
    }
  }, [workUseCase]);

  // R19 · R22: the exchange list is read again every time this tab is shown.
  useEffect(() => {
    if (kind !== 'EXCHANGE_SHIP' || !active) return;
    // Inline async IIFE defers setState past the sync effect body (set-state-in-effect lint).
    void (async () => {
      await loadExchanges();
    })();
  }, [kind, active, loadExchanges]);

  // R18: back to the invoice wait with [송장 없이 반품 완료] off.
  const reset = () => {
    setPhase('INVOICE');
    setClaims([]);
    setEntered({});
    setNoInvoice(false);
    setMessage('');
  };

  const toggleNoInvoice = async () => {
    const next = !noInvoice;
    setNoInvoice(next);
    if (!next) return;
    setIsListLoading(true);
    try {
      setOrders(await workUseCase.shippedOrders());
    } catch (err) {
      setMessage(extractErrorMessage(err, LIST_FAIL));
    } finally {
      setIsListLoading(false);
    }
  };

  const pickOrder = async (order: ShippedOrder) => {
    setMessage('');
    try {
      openClaims(await workUseCase.byOrder(order.orderId));
    } catch (err) {
      setMessage(extractErrorMessage(err, text.lookupFail));
    }
  };

  const filledCount = Object.values(entered).filter((value) => Number(value) > 0).length;

  const pressOtherInvoice = () => {
    if (filledCount === 0) {
      reset();
      return;
    }
    setConfirmOpen(true);
  };

  const save = async () => {
    const invalid = Object.values(entered).some((value) => value !== '' && value !== '0' && !/^\d+$/.test(value));
    if (invalid) {
      setMessage('수량은 0 이상 정수만 입력할 수 있습니다.');
      return;
    }
    const lines = claims.flatMap((claim) =>
      claim.items
        .map((item) => ({ claim, item, quantity: Number(entered[claimItemKey(claim.orderClaimId, item.productId)]) }))
        .filter((line) => line.quantity > 0)
    );
    const over = lines.find((line) => line.quantity > line.item.remainingQty);
    if (over) {
      setMessage(`${over.item.productName}은 더 받을 수 없습니다(남은 ${over.item.remainingQty}개)`);
      return;
    }
    const request = {
      movedOn,
      lines: lines.map((line) => ({
        orderClaimId: line.claim.orderClaimId,
        productId: line.item.productId,
        quantity: line.quantity,
      })),
    };
    setIsSaving(true);
    setMessage('');
    try {
      if (kind === 'RETURN_IN') {
        await workUseCase.returnIn(request);
      } else {
        await workUseCase.exchangeShip(request);
      }
      toast.success(text.saved);
      reset();
      if (kind === 'EXCHANGE_SHIP') void loadExchanges();
    } catch (err) {
      setMessage(extractErrorMessage(err, text.saveFail));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className={active ? 'space-y-4' : 'hidden'}>
      <ScanInput
        mode={phase === 'INVOICE' ? 'INVOICE' : 'ITEM'}
        buffer={buffer}
        disabled={isSaving}
        isScanning={isScanning}
      />

      {message && (
        <div className="p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">{message}</div>
      )}

      {phase === 'INVOICE' && (
        <>
          {kind === 'RETURN_IN' && (
            <div className="space-y-2">
              <Button
                size="sm"
                variant="secondary"
                onClick={() => void toggleNoInvoice()}
              >
                {noInvoice ? '반품 송장으로 찾기' : '송장 없이 반품 완료'}
              </Button>
              {noInvoice && (
                <p className="text-sm text-gray-700">박스의 출고 송장을 찍거나 아래 목록에서 주문을 고르세요.</p>
              )}
            </div>
          )}
          {kind === 'RETURN_IN' && noInvoice && (
            <ShippedOrderTable orders={orders} isLoading={isListLoading} onPick={(order) => void pickOrder(order)} />
          )}
          {kind === 'EXCHANGE_SHIP' && (
            <OpenExchangeTable
              claims={exchanges}
              isLoading={isListLoading}
              onPick={(claim) => openClaims([claim])}
            />
          )}
        </>
      )}

      {phase === 'ITEM' && (
        <>
          <div>
            <Button
              size="sm"
              variant="secondary"
              onClick={pressOtherInvoice}
            >
              다른 송장
            </Button>
          </div>
          {claims.map((claim) => (
            <ClaimWorkCard
              key={claim.orderClaimId}
              claim={claim}
              kind={kind}
              entered={entered}
              onChangeEntered={(key, value) => setEntered((prev) => ({ ...prev, [key]: value }))}
            />
          ))}
          <div className="flex flex-wrap items-end justify-end gap-2">
            <div>
              <label className="block text-xs text-gray-500 mb-1">{text.dateLabel}</label>
              <input
                type="date"
                value={movedOn}
                onChange={(e) => setMovedOn(e.target.value)}
                className={INPUT_CLASS}
              />
            </div>
            <Button onClick={save} disabled={filledCount === 0} isLoading={isSaving} loadingText="저장 중...">
              {text.saveLabel}
            </Button>
          </div>
        </>
      )}

      <ConfirmDialog
        isOpen={confirmOpen}
        title="다른 송장"
        message={`담은 ${filledCount}줄을 버리고 다른 송장을 찍을까요?`}
        onConfirm={() => {
          setConfirmOpen(false);
          reset();
        }}
        onCancel={() => setConfirmOpen(false)}
      />
    </div>
  );
}
