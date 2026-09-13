'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import axios from 'axios';
import { PageContainer } from '@/presentation/components/PageContainer';
import { Card } from '@/presentation/components/ui/Card';
import { Button } from '@/presentation/components/ui/Button';
import { ConfirmDialog } from '@/presentation/components/ui/ConfirmDialog';
import { BoxShape } from '@/presentation/components/BoxShape';
import { PackingUseCase } from '@/application/usecases/PackingUseCase';
import { PackingRepositoryImpl } from '@/infrastructure/repositories/PackingRepositoryImpl';
import { PackageUseCase } from '@/application/usecases/PackageUseCase';
import { PackageRepositoryImpl } from '@/infrastructure/repositories/PackageRepositoryImpl';
import { BOX_KIND_LABEL, boxKindOf, type Package } from '@/domain/entities/PackageEntity';
import type {
  BoxCandidate,
  BoxCandidateItem,
  PackedItemRequest,
  PackingScanResponse,
  PendingParcel,
} from '@/domain/entities/PackingEntity';
import { ScanInput } from './components/ScanInput';
import { PackingItemList, type PackedRow } from './components/PackingItemList';
import { BoxCandidateRow } from './components/BoxCandidateRow';
import { PendingParcelList } from './components/PendingParcelList';

/**
 * 송장 스캔 포장 화면 — 키보드 전용 (FEATURE_2609_40 / PLAN D9 ~ D17 · D31 ~ D33).
 *
 * 🔴 **상태는 이 페이지가 전부 소유한다.** 자식은 값을 받아 그리고 이벤트만 올린다 — 스캔 버퍼가
 * 두 곳에 있으면 포커스가 벗어났을 때 스캔이 허공으로 간다.
 *
 * 🔴 **전역 키 수신**: 어디에 포커스가 있어도 문자가 스캔 버퍼로 모인다. 입력칸을 눌러야만
 * 동작하게 만들면 현장에서 못 쓴다. (수동 입력칸·수량칸 안에서는 그 칸이 키를 갖는다)
 *
 * 🔴 **맞는 스캔은 서버를 부르지 않는다**(D11). 조회 응답에 실려 온 바코드로 화면에서 맞추고,
 * 못 맞췄을 때만 `lookupBarcode` 로 물어본다.
 *
 * 🔴 **입력 구분(D33)**: ① 송장 대기 중이면 송장 조회 ② 5자리 이상이면 물품 스캔
 * ③ 4자리 이하 순수 숫자면 직전에 담은 물품의 수량 수정. 상자 선택은 숫자키가 아니라 F1·F2·F3 다 —
 * 13자리 바코드가 수량 13 으로 들어가는 것을 막는 규칙이다.
 */

/** 4자리 이하 순수 숫자 = 수량 수정 (D33). 경계값은 「4자리 이하 바코드가 없다」는 실측에 달려 있다 */
const QUANTITY_PATTERN = /^\d{1,4}$/;

const rowKey = (orderLineId: number, productId: number) => `${orderLineId}:${productId}`;

type MessageTone = 'info' | 'error' | 'success';

const TONE_CLASS: Record<MessageTone, string> = {
  info: 'border-gray-300 bg-gray-50 text-gray-700',
  error: 'border-red-300 bg-red-50 text-red-700',
  success: 'border-green-300 bg-green-50 text-green-700',
};

/** 서버 메시지를 그대로 보여준다 — 판정은 서버가 소유한다 */
const serverMessage = (error: unknown, fallback: string): string => {
  if (axios.isAxiosError(error)) {
    const message = error.response?.data?.message;
    if (typeof message === 'string' && message.trim()) return message;
  }
  return fallback;
};

/** 전역 키 수신이 매 렌더 최신 상태를 보게 하는 핸들러 묶음 */
interface KeyHandlers {
  /** 키를 받을 상태인가 ([작업 시작] 이후 · 확인 팝업이 없을 때) */
  enabled: boolean;
  /** 완료·닫기 전송 중 = 모든 키 차단(중복 전송 방지) */
  busy: boolean;
  submit: () => void;
  append: (char: string) => void;
  backspace: () => void;
  cancel: () => void;
  unused: () => void;
  selectCandidate: (index: number) => void;
}

/** 후보 중 기본 선택 = 가장 최근에 쓴 것 (D23) */
const defaultCandidate = (candidates: BoxCandidate[]): number | null => {
  if (candidates.length === 0) return null;
  const latest = [...candidates].sort((a, b) => {
    const at = a.lastUsedAt ? new Date(a.lastUsedAt).getTime() : 0;
    const bt = b.lastUsedAt ? new Date(b.lastUsedAt).getTime() : 0;
    return bt - at;
  })[0];
  return latest.packageId;
};

export default function StockPackingPage() {
  const packingUseCase = useMemo(() => new PackingUseCase(new PackingRepositoryImpl()), []);
  const packageUseCase = useMemo(() => new PackageUseCase(new PackageRepositoryImpl()), []);

  // 🔴 브라우저는 사용자가 한 번 클릭하기 전에는 소리를 내지 않는다 → [작업 시작] 이 그 클릭이다
  const [started, setStarted] = useState(false);

  const [buffer, setBuffer] = useState('');
  const bufferRef = useRef('');
  const setScanBuffer = useCallback((value: string) => {
    bufferRef.current = value;
    setBuffer(value);
  }, []);

  const [scanResult, setScanResult] = useState<PackingScanResponse | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [packed, setPacked] = useState<Record<string, number>>({});
  const [lastTouched, setLastTouched] = useState<{ key: string; productId: number } | null>(null);

  const [candidates, setCandidates] = useState<BoxCandidate[]>([]);
  const [candidatesLoading, setCandidatesLoading] = useState(false);
  const [selectedPackageId, setSelectedPackageId] = useState<number | null>(null);
  const manualPickRef = useRef(false);
  const candidateReqRef = useRef(0);

  /** 기억이 없는 조합에서 고를 전체 상자 목록 — 필터 없이 부른다(재활용 상자 포함) */
  const [allPackages, setAllPackages] = useState<Package[]>([]);

  const [pendingParcels, setPendingParcels] = useState<PendingParcel[]>([]);
  const [pendingLoading, setPendingLoading] = useState(false);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [unusedOpen, setUnusedOpen] = useState(false);
  const [message, setMessage] = useState<{ tone: MessageTone; text: string } | null>(null);

  // ── 음성 (D12 · D13) ───────────────────────────────────────────────────────

  /** 브라우저 내장 음성으로 짧게. 라이브러리를 쓰지 않는다 */
  const speak = useCallback((text: string) => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'ko-KR';
    utterance.rate = 1.1;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
  }, []);

  /** 음성과 **함께** 화면에도 표시한다 — 소리를 못 듣는 환경이 있다 */
  const notify = useCallback(
    (tone: MessageTone, text: string, spoken?: string) => {
      setMessage({ tone, text });
      if (spoken) speak(spoken);
    },
    [speak]
  );

  // ── 파생 값 ────────────────────────────────────────────────────────────────

  const isPending = scanResult?.parcel.status === 'PENDING';

  const rows: PackedRow[] = useMemo(() => {
    if (!scanResult) return [];
    return scanResult.remaining.map((item) => ({
      orderLineId: item.orderLineId,
      productId: item.productId,
      productName: item.productName,
      itemName: item.itemName,
      barcodeId: item.barcodeId,
      packedQty: packed[rowKey(item.orderLineId, item.productId)] ?? 0,
      remainingQty: item.remainingQty,
    }));
  }, [scanResult, packed]);

  const remainingTotal = useMemo(
    () => rows.reduce((sum, row) => sum + row.remainingQty, 0),
    [rows]
  );
  const packedTotal = useMemo(() => rows.reduce((sum, row) => sum + row.packedQty, 0), [rows]);

  /** 상자 후보를 물을 조합 — 키는 물품 × 수량뿐이다(D22). 여러 라인의 같은 물품은 합친다 */
  const compositionItems: BoxCandidateItem[] = useMemo(() => {
    const byProduct = new Map<number, number>();
    rows.forEach((row) => {
      if (row.packedQty <= 0) return;
      byProduct.set(row.productId, (byProduct.get(row.productId) ?? 0) + row.packedQty);
    });
    return [...byProduct.entries()].map(([productId, quantity]) => ({ productId, quantity }));
  }, [rows]);

  /** 완료 요청에 실을 항목 — 합포장 대비로 라인을 유지한다(D2) */
  const packedItems: PackedItemRequest[] = useMemo(
    () =>
      rows
        .filter((row) => row.packedQty > 0)
        .map((row) => ({
          orderLineId: row.orderLineId,
          productId: row.productId,
          quantity: row.packedQty,
        })),
    [rows]
  );

  const compositionKey = useMemo(
    () => compositionItems.map((item) => `${item.productId}x${item.quantity}`).join(','),
    [compositionItems]
  );

  const selectedBox = useMemo(() => {
    if (!selectedPackageId) return null;
    const candidate = candidates.find((item) => item.packageId === selectedPackageId);
    if (candidate) return { type: candidate.type };
    const pkg = allPackages.find((item) => item.id === selectedPackageId);
    return pkg ? { type: pkg.type } : null;
  }, [selectedPackageId, candidates, allPackages]);

  /** 기억이 없는 조합 → 전체 상자 목록에서 고르게 한다 */
  const showAllBoxes =
    isPending && compositionItems.length > 0 && !candidatesLoading && candidates.length === 0;

  // ── 조회 ───────────────────────────────────────────────────────────────────

  const loadPending = useCallback(async () => {
    setPendingLoading(true);
    try {
      setPendingParcels(await packingUseCase.pending());
    } catch {
      setPendingParcels([]);
    } finally {
      setPendingLoading(false);
    }
  }, [packingUseCase]);

  // set-state-in-effect 회피 = 인라인 async IIFE (프로젝트 표준)
  useEffect(() => {
    void (async () => {
      await loadPending();
      try {
        // 🔴 기억이 없는 조합에서 고를 전체 목록 — 필터 없이 = 재활용 상자 포함
        setAllPackages(await packageUseCase.getPackages());
      } catch {
        setAllPackages([]);
      }
    })();
  }, [loadPending, packageUseCase]);

  /** 담은 조합이 바뀔 때마다 후보를 다시 묻는다 (D23) */
  useEffect(() => {
    if (!scanResult || scanResult.parcel.status !== 'PENDING') return;
    void (async () => {
      if (compositionItems.length === 0) {
        candidateReqRef.current += 1;
        manualPickRef.current = false;
        setCandidates([]);
        setCandidatesLoading(false);
        setSelectedPackageId(null);
        return;
      }
      const requestId = (candidateReqRef.current += 1);
      setCandidatesLoading(true);
      try {
        const list = await packingUseCase.boxCandidates(compositionItems);
        if (requestId !== candidateReqRef.current) return;
        setCandidates(list);
        setSelectedPackageId((previous) => {
          if (manualPickRef.current && previous && list.some((c) => c.packageId === previous)) {
            return previous;
          }
          manualPickRef.current = false;
          return defaultCandidate(list);
        });
      } catch {
        if (requestId === candidateReqRef.current) setCandidates([]);
      } finally {
        if (requestId === candidateReqRef.current) setCandidatesLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [compositionKey, scanResult?.parcel.id]);

  // ── 동작 ───────────────────────────────────────────────────────────────────

  const resetBox = useCallback(() => {
    setScanResult(null);
    setPacked({});
    setLastTouched(null);
    setCandidates([]);
    setSelectedPackageId(null);
    manualPickRef.current = false;
    setScanBuffer('');
  }, [setScanBuffer]);

  const handleInvoiceScan = useCallback(
    async (invoiceNumber: string) => {
      setIsScanning(true);
      setMessage(null);
      try {
        const result = await packingUseCase.scan(invoiceNumber);
        setScanResult(result);
        setPacked({});
        setLastTouched(null);
        setCandidates([]);
        setSelectedPackageId(null);
        manualPickRef.current = false;

        if (result.parcel.status === 'PACKED') {
          notify('error', '이미 출고된 박스입니다', '이미 출고된 박스입니다');
        } else if (result.parcel.status === 'UNUSED') {
          notify('error', '사용하지 않은 박스입니다', '사용하지 않은 박스입니다');
        } else if (result.unexpanded.length > 0) {
          notify(
            'error',
            '구성 물품을 전개할 수 없는 주문입니다 — 이 박스는 완료할 수 없습니다',
            '구성 물품을 전개할 수 없습니다'
          );
        } else if (result.remaining.length === 0) {
          notify(
            'info',
            '담을 물품이 없습니다 — [F4] 이 박스 사용 안 함으로 닫으세요',
            '담을 물품이 없습니다'
          );
        }
      } catch (error) {
        const notFound = axios.isAxiosError(error) && error.response?.status === 404;
        const text = notFound
          ? '아직 발송처리 전이거나 없는 송장입니다 — 주문 동기화 후 다시 스캔해 주세요'
          : serverMessage(error, '송장 조회에 실패했습니다');
        notify('error', text, notFound ? '없는 송장입니다' : text);
      } finally {
        setIsScanning(false);
      }
    },
    [packingUseCase, notify]
  );

  const addOne = useCallback((row: PackedRow) => {
    const key = rowKey(row.orderLineId, row.productId);
    setPacked((previous) => ({ ...previous, [key]: (previous[key] ?? 0) + 1 }));
    setLastTouched({ key, productId: row.productId });
    setMessage(null);
  }, []);

  const handleItemScan = useCallback(
    async (value: string) => {
      if (!scanResult) return;
      // 🔴 D11: 맞는 스캔은 화면에서 끝난다 — 서버 왕복 0회
      const matched = rows.filter((row) => (row.barcodeId ?? '').trim() === value);
      if (matched.length > 0) {
        const target = matched.find((row) => row.packedQty < row.remainingQty);
        if (!target) {
          notify('error', '수량을 초과했습니다', '수량을 초과했습니다');
          return;
        }
        addOne(target);
        return;
      }

      // 못 맞췄을 때만 서버에 물어본다 (오류 경로라 느려도 된다)
      try {
        const lookup = await packingUseCase.lookupBarcode(value, scanResult.parcel.id);
        if (!lookup.found) {
          notify(
            'error',
            `등록되지 않은 바코드입니다 (${value}) — 물품에 바코드를 등록해 주세요`,
            '등록되지 않은 바코드입니다'
          );
          return;
        }
        if (!lookup.inThisParcel) {
          notify('error', `없는 물품입니다 — ${lookup.productName ?? value}`, '없는 물품입니다');
          return;
        }
        const target = rows.find(
          (row) => row.productId === lookup.productId && row.packedQty < row.remainingQty
        );
        if (!target) {
          notify('error', '수량을 초과했습니다', '수량을 초과했습니다');
          return;
        }
        addOne(target);
      } catch (error) {
        const text = serverMessage(error, '바코드 조회에 실패했습니다');
        notify('error', text, text);
      }
    },
    [scanResult, rows, addOne, notify, packingUseCase]
  );

  /** 수량 수정은 **직전에 담은 물품 하나**에만 적용된다 (D33) */
  const handleQuantityInput = useCallback(
    (quantity: number) => {
      if (!lastTouched) {
        notify('info', '먼저 물품을 스캔하세요', '먼저 물품을 스캔하세요');
        return;
      }
      const row = rows.find((item) => rowKey(item.orderLineId, item.productId) === lastTouched.key);
      if (!row) return;
      if (quantity > row.remainingQty) {
        notify('error', '수량을 초과했습니다', '수량을 초과했습니다');
        return;
      }
      setPacked((previous) => ({ ...previous, [lastTouched.key]: quantity }));
      setMessage(null);
    },
    [lastTouched, rows, notify]
  );

  const handleQuantityChange = useCallback(
    (productId: number, quantity: number) => {
      const row =
        rows.find(
          (item) =>
            item.productId === productId &&
            rowKey(item.orderLineId, item.productId) === lastTouched?.key
        ) ?? rows.find((item) => item.productId === productId);
      if (!row) return;
      const key = rowKey(row.orderLineId, row.productId);
      const next = Math.max(0, Math.min(Number.isFinite(quantity) ? quantity : 0, row.remainingQty));
      setPacked((previous) => ({ ...previous, [key]: next }));
      setLastTouched({ key, productId: row.productId });
    },
    [rows, lastTouched]
  );

  const handleSelectBox = useCallback((packageId: number) => {
    manualPickRef.current = true;
    setSelectedPackageId(packageId);
  }, []);

  const handleSelectCandidate = useCallback(
    (index: number) => {
      if (!isPending) return;
      const candidate = candidates[index];
      if (!candidate) return;
      handleSelectBox(candidate.packageId);
    },
    [isPending, candidates, handleSelectBox]
  );

  const handleComplete = useCallback(async () => {
    if (!scanResult) {
      notify('info', '송장을 먼저 스캔하세요');
      return;
    }
    if (!isPending) {
      notify(
        'error',
        scanResult.parcel.status === 'PACKED' ? '이미 출고된 박스입니다' : '사용하지 않은 박스입니다'
      );
      return;
    }
    if (scanResult.unexpanded.length > 0) {
      notify(
        'error',
        '구성 물품을 전개할 수 없는 주문입니다 — 이 박스는 완료할 수 없습니다',
        '구성 물품을 전개할 수 없습니다'
      );
      return;
    }
    if (packedItems.length === 0) {
      notify(
        'error',
        '담을 물품이 없습니다 — [F4] 이 박스 사용 안 함으로 닫으세요',
        '담을 물품이 없습니다'
      );
      return;
    }
    if (!selectedPackageId) {
      notify('error', '상자를 먼저 선택하세요 (F1 · F2 · F3)', '상자를 선택하세요');
      return;
    }
    // 🔴 D13: 작업 대상이 이 박스뿐이면 남은 물품 전량을 요구한다 — 마지막 검문소다
    if (scanResult.isLastParcel && packedTotal < remainingTotal) {
      notify('error', '제품 수량을 확인하세요', '제품 수량을 확인하세요');
      return;
    }

    setIsSubmitting(true);
    try {
      await packingUseCase.complete(scanResult.parcel.id, {
        boxPackageId: selectedPackageId,
        items: packedItems,
      });
      const left = remainingTotal - packedTotal;
      resetBox();
      notify(
        'success',
        left > 0 ? `완료 — 남은 ${left}개, 다음 송장을 스캔하세요` : '완료 — 다음 송장을 스캔하세요',
        '완료'
      );
      loadPending();
    } catch (error) {
      // 🔴 담은 내용은 지우지 않는다 — 다시 스캔시키면 안 된다
      const text = serverMessage(error, '박스 완료에 실패했습니다');
      notify('error', text, text);
    } finally {
      setIsSubmitting(false);
    }
  }, [
    scanResult,
    isPending,
    packedItems,
    selectedPackageId,
    packedTotal,
    remainingTotal,
    packingUseCase,
    resetBox,
    notify,
    loadPending,
  ]);

  const handleCancelBox = useCallback(() => {
    if (!scanResult) {
      setScanBuffer('');
      return;
    }
    resetBox();
    notify('info', '이 박스를 취소했습니다 — 송장을 스캔하세요');
  }, [scanResult, resetBox, notify, setScanBuffer]);

  const handleMarkUnused = useCallback(async () => {
    if (!scanResult) return;
    setUnusedOpen(false);
    setIsSubmitting(true);
    try {
      await packingUseCase.markUnused(scanResult.parcel.id);
      resetBox();
      notify('success', '사용하지 않은 박스로 닫았습니다', '닫았습니다');
      loadPending();
    } catch (error) {
      const text = serverMessage(error, '박스를 닫지 못했습니다');
      notify('error', text, text);
    } finally {
      setIsSubmitting(false);
    }
  }, [scanResult, packingUseCase, resetBox, notify, loadPending]);

  /** 🔴 입력 구분 규칙(D33)이 사는 단 한 곳 */
  const handleScannedValue = useCallback(
    (raw: string) => {
      const value = raw.trim();
      if (!value) {
        handleComplete();
        return;
      }
      if (!scanResult) {
        handleInvoiceScan(value);
        return;
      }
      if (!isPending) {
        notify(
          'error',
          scanResult.parcel.status === 'PACKED'
            ? '이미 출고된 박스입니다 — [Esc] 로 취소하고 다음 송장을 스캔하세요'
            : '사용하지 않은 박스입니다 — [Esc] 로 취소하고 다음 송장을 스캔하세요'
        );
        return;
      }
      if (QUANTITY_PATTERN.test(value)) {
        handleQuantityInput(Number(value));
        return;
      }
      handleItemScan(value);
    },
    [
      scanResult,
      isPending,
      handleComplete,
      handleInvoiceScan,
      handleQuantityInput,
      handleItemScan,
      notify,
    ]
  );

  // ── 전역 키 수신 ───────────────────────────────────────────────────────────

  /**
   * 매 렌더마다 최신 핸들러를 담아 두고, 리스너는 **한 번만** 등록한다.
   * 리스너를 매번 다시 붙이면 빠른 스캔 도중 키가 샌다.
   */
  const noop = () => {};
  const handlersRef = useRef<KeyHandlers>({
    enabled: false,
    busy: false,
    submit: noop,
    append: noop,
    backspace: noop,
    cancel: noop,
    unused: noop,
    selectCandidate: noop,
  });

  // 렌더 중에 ref 를 쓰면 lint 가 막는다 → 매 렌더 뒤 이펙트에서 갱신한다(의존성 배열 없음).
  useEffect(() => {
    handlersRef.current = {
      // 확인 팝업이 떠 있으면 키는 팝업의 것이다
      enabled: started && !unusedOpen,
      busy: isSubmitting || isScanning,
      submit: () => {
        const value = bufferRef.current;
        setScanBuffer('');
        handleScannedValue(value);
      },
      append: (char: string) => setScanBuffer(bufferRef.current + char),
      backspace: () => setScanBuffer(bufferRef.current.slice(0, -1)),
      cancel: handleCancelBox,
      unused: () => {
        if (scanResult) setUnusedOpen(true);
      },
      selectCandidate: handleSelectCandidate,
    };
  });

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const handlers = handlersRef.current;
      if (!handlers.enabled) return;

      const target = event.target as HTMLElement | null;
      const tag = target?.tagName;
      // 버튼에 포커스가 있으면 Enter/Space 는 그 버튼의 것이다 (전체 상자 목록을 키보드로 고른다)
      if (tag === 'BUTTON' && (event.key === 'Enter' || event.key === ' ')) return;

      // 🔴 스캐너는 문자 + Enter 만 보낸다 → F1~F4 와 절대 충돌하지 않는다.
      //    브라우저 기본 동작(F1 = 도움말)은 여기서 막는다.
      if (/^F[1-4]$/.test(event.key)) {
        event.preventDefault();
        if (handlers.busy) return;
        if (event.key === 'F4') handlers.unused();
        else handlers.selectCandidate(Number(event.key.slice(1)) - 1);
        return;
      }

      const isFormField = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
      if (isFormField) return;
      if (event.ctrlKey || event.metaKey || event.altKey) return;

      if (event.key === 'Escape') {
        event.preventDefault();
        if (handlers.busy) return;
        handlers.cancel();
        return;
      }
      // 완료·닫기 중에는 모든 키를 막는다 (중복 전송 방지)
      if (handlers.busy) return;

      if (event.key === 'Enter') {
        event.preventDefault();
        handlers.submit();
        return;
      }
      if (event.key === 'Backspace') {
        event.preventDefault();
        handlers.backspace();
        return;
      }
      if (event.key.length === 1) {
        event.preventDefault();
        handlers.append(event.key);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  // ── 화면 ───────────────────────────────────────────────────────────────────

  const parcel = scanResult?.parcel;

  return (
    <PageContainer title="포장 작업">
      {!started ? (
        <Card>
          <div className="flex flex-col items-center gap-3 py-8">
            <p className="text-gray-700">
              스캐너를 연결한 뒤 [작업 시작]을 누르세요. 처음 한 번 눌러야 안내 음성이 나옵니다.
            </p>
            <Button
              onClick={(event) => {
                event.currentTarget.blur();
                setStarted(true);
              }}
            >
              작업 시작
            </Button>
          </div>
        </Card>
      ) : (
        <Card>
          <div className="space-y-4">
            <ScanInput
              mode={scanResult && isPending ? 'ITEM' : 'INVOICE'}
              buffer={buffer}
              disabled={isSubmitting}
              isScanning={isScanning}
              onScan={handleScannedValue}
            />

            {parcel && (
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-gray-100 pt-3">
                <span className="font-mono text-lg font-semibold text-gray-900">
                  {parcel.invoiceNumber}
                </span>
                <span className="text-sm text-gray-500">{parcel.carrierName ?? '택배사 미상'}</span>
                <span className="text-sm text-gray-700">
                  {parcel.totalParcels > 1
                    ? `${parcel.totalParcels}박스 중 ${parcel.parcelSeq ?? '-'}번째`
                    : '1박스'}
                </span>
                <span className="text-sm text-gray-700">
                  {scanResult?.order.sellerName ?? '-'} · 주문 {scanResult?.order.externalOrderId}
                </span>
                {scanResult?.isLastParcel && (
                  <span className="rounded bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
                    마지막 박스 — 남은 물품 전량을 담아야 합니다
                  </span>
                )}
              </div>
            )}

            {message && (
              <div className={`rounded border px-4 py-3 text-sm ${TONE_CLASS[message.tone]}`}>
                {message.text}
              </div>
            )}
          </div>
        </Card>
      )}

      {started && scanResult && isPending && (
        <>
          <Card padded={false}>
            <div className="flex items-center justify-between px-4 py-3">
              <h2 className="font-semibold text-gray-900">담을 것</h2>
              <span className="text-sm text-gray-500">
                담음 {packedTotal} / 필요 {remainingTotal}
              </span>
            </div>
            <PackingItemList
              items={rows}
              lastTouchedProductId={lastTouched?.productId ?? null}
              onQuantityChange={handleQuantityChange}
            />
          </Card>

          <Card>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="font-semibold text-gray-900">상자</h2>
                <span className="text-sm text-gray-500">
                  {selectedBox ? `선택: ${selectedBox.type}` : '선택된 상자 없음'}
                </span>
              </div>

              {compositionItems.length === 0 ? (
                <p className="text-sm text-gray-500">물품을 담으면 상자를 추천합니다.</p>
              ) : (
                <BoxCandidateRow
                  candidates={candidates}
                  selectedPackageId={selectedPackageId}
                  loading={candidatesLoading}
                  onSelect={handleSelectBox}
                />
              )}

              {showAllBoxes && (
                <div className="space-y-2 border-t border-gray-100 pt-3">
                  <p className="text-sm text-gray-500">
                    전체 상자에서 고르세요. 고른 상자는 이 조합으로 기억됩니다.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {allPackages.map((pkg) => (
                      <button
                        key={pkg.id}
                        type="button"
                        onClick={(event) => {
                          event.currentTarget.blur();
                          handleSelectBox(pkg.id);
                        }}
                        className={`flex w-52 items-center gap-2 rounded-lg border p-2 text-left ${
                          pkg.id === selectedPackageId
                            ? 'border-blue-600 bg-blue-50'
                            : 'border-gray-200 bg-white hover:border-gray-300'
                        }`}
                      >
                        <div className="flex h-11 w-11 shrink-0 items-center justify-center">
                          {pkg.imageUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={pkg.imageUrl}
                              alt={`${pkg.type} 상자 사진`}
                              className="h-11 w-11 rounded border border-gray-200 object-contain"
                            />
                          ) : (
                            <BoxShape
                              widthCm={pkg.widthCm}
                              lengthCm={pkg.lengthCm}
                              heightCm={pkg.heightCm}
                            />
                          )}
                        </div>
                        <div className="min-w-0">
                          <div className="truncate text-sm font-medium text-gray-900">
                            {pkg.type}
                          </div>
                          <div className="text-xs text-gray-500">
                            {pkg.widthCm} × {pkg.lengthCm} × {pkg.heightCm} cm
                          </div>
                          <div className="text-xs text-gray-500">
                            {BOX_KIND_LABEL[boxKindOf(pkg)]}
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </Card>

          <Card>
            <div className="flex flex-wrap items-center gap-3">
              <Button onClick={handleComplete} isLoading={isSubmitting} loadingText="완료 처리 중...">
                [Enter] 이 박스 완료
              </Button>
              <Button variant="secondary" onClick={handleCancelBox} disabled={isSubmitting}>
                [Esc] 취소
              </Button>
              <Button
                variant="danger"
                onClick={() => setUnusedOpen(true)}
                disabled={isSubmitting}
              >
                [F4] 이 박스 사용 안 함
              </Button>
              <span className="text-sm text-gray-500">
                상자 선택 = F1 · F2 · F3 · 숫자 4자리 이하 + Enter = 직전 물품 수량 수정
              </span>
            </div>
          </Card>
        </>
      )}

      {started && scanResult && !isPending && (
        <Card>
          <div className="flex flex-wrap items-center gap-3">
            <Button variant="secondary" onClick={handleCancelBox} disabled={isSubmitting}>
              [Esc] 다음 송장 스캔
            </Button>
          </div>
        </Card>
      )}

      <div>
        <h2 className="mb-2 font-semibold text-gray-900">작업 대상 박스</h2>
        <PendingParcelList
          parcels={pendingParcels}
          loading={pendingLoading}
          onOpen={(invoiceNumber) => {
            if (!started) setStarted(true);
            handleInvoiceScan(invoiceNumber);
          }}
        />
      </div>

      <ConfirmDialog
        isOpen={unusedOpen}
        title="이 박스 사용 안 함"
        message="송장을 쓰지 않은 박스로 닫습니다. 출고·상자 기억을 남기지 않으며 되돌릴 수 없습니다."
        confirmText="사용 안 함으로 닫기"
        onConfirm={handleMarkUnused}
        onCancel={() => setUnusedOpen(false)}
        isDangerous
        isLoading={isSubmitting}
      />
    </PageContainer>
  );
}
