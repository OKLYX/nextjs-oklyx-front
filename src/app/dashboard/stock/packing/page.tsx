'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import axios from 'axios';
import { ScanLine } from 'lucide-react';
import { PageContainer, CONTENT_WIDTH } from '@/presentation/components/PageContainer';
import { Card } from '@/presentation/components/ui/Card';
import { Button } from '@/presentation/components/ui/Button';
import { ConfirmDialog } from '@/presentation/components/ui/ConfirmDialog';
import { Modal } from '@/presentation/components/ui/Modal';
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
import { RightRailTabs, type RailTab } from './components/RightRailTabs';

/**
 * 송장 스캔 포장 화면 — 키보드 전용 (FEATURE_2609_40 / PLAN D9 ~ D17 · D31 ~ D33,
 * FEATURE_2609_53 / PLAN D1 ~ D10, FEATURE_2609_54 / PLAN D1 ~ D14,
 * FEATURE_2609_55 / PLAN D1 ~ D12).
 *
 * 🔴 **화면 상태는 네 개다**: 시작 화면(`!started`) · 송장 대기(`started && !scanResult`) ·
 * 담는 중(`scanResult && isPending`) · 닫힌 박스(`scanResult && !isPending`).
 *
 * 🔴 **몰입 레이어 안의 세 상태는 같은 골격을 쓴다**(2609_55/D1): 상단 정보 줄 · 안내문 ·
 * `22rem | 1fr | 20rem` 3열 · 하단 유틸리티 줄이 **항상** 그려지고 **칸의 내용만** 바뀐다.
 * 자리가 상태마다 움직이면 작업자가 눈을 어디에 둘지 배울 수 없다. 그래서 레이아웃은
 * `leftColumn` · `centerColumn` · `rightRail` **열 단위 조각**으로만 만든다 — 상태별로 레이아웃을
 * 따로 들고 있으면 상태가 자리를 흔든다. `xl:grid-cols-[22rem_1fr_20rem]` 은 이 파일에 한 번만 나온다.
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
 * ③ 4자리 이하 순수 숫자면 **고른 줄 하나**(↑↓ 또는 스캔으로 이동)의 수량 수정. 상자 선택은
 * 숫자키가 아니라 F1·F2·F3 다 — 13자리 바코드가 수량 13 으로 들어가는 것을 막는 규칙이다.
 *
 * 🔴 **몰입 모드(2609_53/D1)**: [작업 시작] 이후엔 `fixed inset-0` 레이어가 사이드바·상단바를 덮는다.
 * 브라우저 Fullscreen API 를 쓰지 않는다 — 쓰면 브라우저가 Esc 를 먼저 가져가 Esc 한 겹 벗기기(D3)가
 * 통째로 깨진다. 폭은 `PageContainer` 의 `CONTENT_WIDTH` 하나에서 온다(D10, 손으로 적지 않는다).
 *
 * 🔴 **방향키는 DOM 포커스를 옮기지 않는다(2609_53/D5)**. 선택은 state 로만 표시하고 Enter 의 주인은
 * 언제나 이 페이지 하나다. `element.focus()` 를 부르지 않는다.
 */

/** 4자리 이하 순수 숫자 = 수량 수정 (D33). 경계값은 「4자리 이하 바코드가 없다」는 실측에 달려 있다 */
const QUANTITY_PATTERN = /^\d{1,4}$/;

const rowKey = (orderLineId: number, productId: number) => `${orderLineId}:${productId}`;

/** 끝에서 멈춘다 — 순환하면 현장에서 어디까지 왔는지 놓친다 */
const clampIndex = (index: number, length: number) => Math.max(0, Math.min(index, length - 1));

/**
 * 스캐너는 문자 + Enter 를 보낸다 — 팝업 위로 날아든 Enter 가 확인 버튼을 누르는 것을 막는다(D4).
 * 400ms 근거: 스캐너는 바코드 한 줄을 보통 100ms 안에 다 보낸다(사람 타자는 그보다 느리다).
 * 줄이면 빠른 스캔의 Enter 가 새어 들어오고, 늘리면 사람이 Enter 를 두 번 눌러야 한다.
 */
const SCAN_ENTER_GUARD_MS = 400;

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
  /** Esc · F7 — 박스를 잡고 있으면 이 박스 취소, 송장 대기면 나가기 팝업 (D3) */
  cancel: () => void;
  unused: () => void;
  selectCandidate: (index: number) => void;
  /** F6 = [이 박스 완료]. 버퍼를 거치지 않는다 — 타다 만 글자가 있어도 완료는 완료다 */
  submitBox: () => void;
  /** ↑ — 박스 잡은 중이면 담을 것 줄, 송장 대기면 작업 대상 목록 (D6) */
  moveUp: () => void;
  /** ↓ — 같은 축 */
  moveDown: () => void;
  /** ← → — 상자 후보/전체 상자 이동 = 즉시 선택 */
  moveBox: (delta: number) => void;
  /** F8 — 단축키 도움말 */
  help: () => void;
  /** F9 — 안내 음성 켜기/끄기 */
  toggleVoice: () => void;
  /** F10 — 오른쪽 열 탭 전환 (작업 대상 ↔ 오늘 완료). 2609_53/D7 부분 번복 = 2609_55/D6 */
  toggleRail: () => void;
}

/** F8 도움말 표 — 화면에 적힌 두 길(F키 · 방향키)을 한 곳에 모아 둔다 */
const SHORTCUT_HELP: [string, string][] = [
  [
    '스캔 / 입력 후 Enter',
    '송장 조회 → 물품 담기 (5자리 이상 = 바코드, 4자리 이하 숫자 = 고른 줄 수량)',
  ],
  ['Enter (빈 상태)', '송장 대기: 고른 송장 열기 / 박스 잡은 중: 이 박스 완료'],
  ['↑ ↓', '송장 대기: 작업 대상 박스 이동 / 박스 잡은 중: 담을 것 줄 이동'],
  ['← →', '상자 고르기 (즉시 선택)'],
  ['F1 · F2 · F3', '추천 상자 1 · 2 · 3'],
  ['F4', '이 박스 사용 안 함'],
  ['F6 / F7', '이 박스 완료 / 취소'],
  ['F8 / F9', '단축키 / 안내 음성'],
  ['F10', '오른쪽 열 탭 (작업 대상 / 오늘 완료)'],
  ['Esc', '박스 잡은 중: 이 박스 취소 · 송장 대기: 나가기'],
];

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
  /** 고른 줄 key — 스캔으로 담아도, ↑↓ 로 골라도 같은 값이 움직인다 (D8) */
  const [activeRowKey, setActiveRowKey] = useState<string | null>(null);

  const [candidates, setCandidates] = useState<BoxCandidate[]>([]);
  const [candidatesLoading, setCandidatesLoading] = useState(false);
  const [selectedPackageId, setSelectedPackageId] = useState<number | null>(null);
  const manualPickRef = useRef(false);
  const candidateReqRef = useRef(0);

  /** 기억이 없는 조합에서 고를 전체 상자 목록 — 필터 없이 부른다(재활용 상자 포함) */
  const [allPackages, setAllPackages] = useState<Package[]>([]);

  const [pendingParcels, setPendingParcels] = useState<PendingParcel[]>([]);
  const [pendingLoading, setPendingLoading] = useState(false);
  /** 작업 대상 박스 목록에서 ↑↓ 로 고른 줄. 목록이 짧아질 수 있어 쓰는 쪽에서 clamp 한다 */
  const [parcelIndex, setParcelIndex] = useState(0);
  /** 오른쪽 열 탭 — F10 으로 오간다 (2609_55/D5 · D6) */
  const [railTab, setRailTab] = useState<RailTab>('PENDING');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [unusedOpen, setUnusedOpen] = useState(false);
  const [exitOpen, setExitOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [message, setMessage] = useState<{ tone: MessageTone; text: string } | null>(null);

  // ── 음성 (D12 · D13) ───────────────────────────────────────────────────────

  const [voiceOn, setVoiceOn] = useState(true);
  /** `speak` 가 최신 값을 보게 하는 거울 — state 를 읽으면 콜백이 매번 다시 만들어진다 */
  const voiceOnRef = useRef(true);

  /** 브라우저 내장 음성으로 짧게. 라이브러리를 쓰지 않는다 */
  const speak = useCallback((text: string) => {
    if (!voiceOnRef.current) return;
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

  /** F9 — 끄는 순간 **하던 말도 끊는다**. 안 끊으면 꺼진 줄 모른다 */
  const toggleVoice = useCallback(() => {
    const next = !voiceOnRef.current;
    voiceOnRef.current = next;
    setVoiceOn(next);
    if (!next && typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    setMessage({ tone: 'info', text: next ? '안내 음성 켜짐' : '안내 음성 꺼짐' });
  }, []);

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
      imageUrl: item.imageUrl,
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

  /** 고른 상자 — 왼쪽 카드가 이름(크게) · 치수 · 종류를 보여준다(2609_54/Step 5) */
  const selectedBox = useMemo(() => {
    if (!selectedPackageId) return null;
    const candidate = candidates.find((item) => item.packageId === selectedPackageId);
    if (candidate) {
      return {
        type: candidate.type,
        widthCm: candidate.widthCm,
        lengthCm: candidate.lengthCm,
        heightCm: candidate.heightCm,
        boxKind: candidate.boxKind,
      };
    }
    const pkg = allPackages.find((item) => item.id === selectedPackageId);
    return pkg
      ? {
          type: pkg.type,
          widthCm: pkg.widthCm,
          lengthCm: pkg.lengthCm,
          heightCm: pkg.heightCm,
          boxKind: pkg.boxKind,
        }
      : null;
  }, [selectedPackageId, candidates, allPackages]);

  /** 기억이 없는 조합 → 전체 상자 목록에서 고르게 한다 */
  const showAllBoxes =
    isPending && compositionItems.length > 0 && !candidatesLoading && candidates.length === 0;

  /** ↑↓ 로 고른 송장 — 새 상태를 만들지 않고 목록에서 바로 뽑는다 */
  const selectedParcelId =
    pendingParcels[clampIndex(parcelIndex, pendingParcels.length)]?.parcelId ?? null;

  /** ← → 가 훑는 상자 목록 — 화면에 보이는 것과 같아야 한다 */
  const visibleBoxIds = useMemo(
    () => (showAllBoxes ? allPackages.map((pkg) => pkg.id) : candidates.map((c) => c.packageId)),
    [showAllBoxes, allPackages, candidates]
  );

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
    // 🔴 대기로 돌아오면 ↑↓ 의 대상이 보여야 한다 (2609_55/D5). 대기로 오는 모든 경로가 여기를 지난다
    setRailTab('PENDING');
    setPacked({});
    setActiveRowKey(null);
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
        // 첫 줄을 고른 상태로 시작한다 — 바로 「숫자 + Enter」가 먹히게 (D8)
        const first = result.remaining[0];
        setActiveRowKey(first ? rowKey(first.orderLineId, first.productId) : null);
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
    setActiveRowKey(key);
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

  /** 수량 수정은 **고른 줄 하나**에만 적용된다 (D8 — 2609_40/D33 부분 번복) */
  const handleQuantityInput = useCallback(
    (quantity: number) => {
      if (!activeRowKey) {
        notify('info', '담을 물품을 먼저 고르세요 (↑↓)', '담을 물품을 먼저 고르세요');
        return;
      }
      const row = rows.find((item) => rowKey(item.orderLineId, item.productId) === activeRowKey);
      if (!row) return;
      if (quantity > row.remainingQty) {
        notify('error', '수량을 초과했습니다', '수량을 초과했습니다');
        return;
      }
      setPacked((previous) => ({ ...previous, [activeRowKey]: quantity }));
      setMessage(null);
    },
    [activeRowKey, rows, notify]
  );

  /** 수량칸 직접 입력 — **줄 key** 를 받는다. 같은 물품이 두 줄일 때 추측하지 않는다 (D8) */
  const handleQuantityChange = useCallback(
    (key: string, quantity: number) => {
      const row = rows.find((item) => rowKey(item.orderLineId, item.productId) === key);
      if (!row) return;
      const next = Math.max(0, Math.min(Number.isFinite(quantity) ? quantity : 0, row.remainingQty));
      setPacked((previous) => ({ ...previous, [key]: next }));
      setActiveRowKey(key);
    },
    [rows]
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

  /** 나가기 = 몰입 해제 + 시작 화면으로. 라우터를 건드리지 않는다 (D2) */
  const handleExit = useCallback(() => {
    setExitOpen(false);
    resetBox(); // 잡고 있던 박스가 있으면 함께 버린다
    setStarted(false);
    setMessage(null);
  }, [resetBox]);

  // ── 방향키 이동 — 선택 표시만 옮긴다(포커스 이동 없음, D5) ──────────────────

  /** ↑↓ (박스 잡은 중) — 담을 것 줄 이동 */
  const moveRow = useCallback(
    (delta: number) => {
      if (rows.length === 0) return;
      const current = activeRowKey
        ? rows.findIndex((row) => rowKey(row.orderLineId, row.productId) === activeRowKey)
        : -1;
      const next =
        current < 0 ? (delta > 0 ? 0 : rows.length - 1) : clampIndex(current + delta, rows.length);
      const row = rows[next];
      setActiveRowKey(rowKey(row.orderLineId, row.productId));
    },
    [rows, activeRowKey]
  );

  /** ↑↓ (송장 대기) — 작업 대상 박스 목록 이동 */
  const moveParcel = useCallback(
    (delta: number) => {
      // 🔴 「오늘 완료」 탭이 열려 있으면 고른 줄이 안 보인다 → 움직이는 목록을 보여준다.
      //    `moveRow`(담을 것 줄)에는 넣지 않는다 — 담는 중 탭은 작업자가 둔 대로 둔다.
      setRailTab('PENDING');
      const length = pendingParcels.length;
      if (length === 0) return;
      setParcelIndex((previous) => clampIndex(clampIndex(previous, length) + delta, length));
    },
    [pendingParcels.length]
  );

  /** F10 · 하단 버튼 — 오른쪽 열 탭 전환. 🔴 두 길이 같은 함수를 쓴다(한쪽만 고쳐지지 않게) */
  const toggleRailTab = useCallback(
    () => setRailTab((previous) => (previous === 'PENDING' ? 'DONE' : 'PENDING')),
    []
  );

  /** ← → — 상자 이동 = **즉시 선택**. 이미 출고·미사용 박스면 아무 것도 고르지 않는다 */
  const moveBox = useCallback(
    (delta: number) => {
      if (!isPending) return;
      if (visibleBoxIds.length === 0) return;
      const current = selectedPackageId ? visibleBoxIds.indexOf(selectedPackageId) : -1;
      const next =
        current < 0
          ? delta > 0
            ? 0
            : visibleBoxIds.length - 1
          : clampIndex(current + delta, visibleBoxIds.length);
      handleSelectBox(visibleBoxIds[next]);
    },
    [isPending, visibleBoxIds, selectedPackageId, handleSelectBox]
  );

  /** Enter (송장 대기) — 고른 송장 열기 (D6) */
  const openSelectedParcel = useCallback(() => {
    const target = pendingParcels[clampIndex(parcelIndex, pendingParcels.length)];
    if (!target) {
      notify('info', '송장을 먼저 스캔하세요');
      return;
    }
    handleInvoiceScan(target.invoiceNumber);
  }, [pendingParcels, parcelIndex, handleInvoiceScan, notify]);

  /** 🔴 입력 구분 규칙(D33)이 사는 단 한 곳 */
  const handleScannedValue = useCallback(
    (raw: string) => {
      const value = raw.trim();
      if (!value) {
        if (!scanResult) openSelectedParcel(); // 송장 대기 = 고른 송장 열기 (D6)
        else handleComplete();
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
      openSelectedParcel,
      notify,
    ]
  );

  /**
   * 팝업이 떠 있는 동안 Enter 의 주인은 여기 하나다 (D4).
   *
   * 🔴 이 리스너는 **팝업이 떠 있는 동안만** 산다. 전역 스캔 리스너(한 번만 등록)와 섞지 말 것.
   * ⚠️ 도움말(F8)에는 일부러 걸지 않는다 — 거기서 Enter 가 새어도 표가 닫힐 뿐 되돌릴 것이 없다.
   */
  const lastCharAtRef = useRef(0);
  useEffect(() => {
    if (!exitOpen && !unusedOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key.length === 1) {
        lastCharAtRef.current = Date.now();
        return;
      }
      if (event.key !== 'Enter') return;
      event.preventDefault();
      event.stopPropagation(); // 포커스가 어느 버튼에 있든 Enter 의 주인은 여기 하나다
      if (isSubmitting || isScanning) return; // 전송·조회 중 = 중복 실행 금지
      if (Date.now() - lastCharAtRef.current < SCAN_ENTER_GUARD_MS) {
        notify(
          'error',
          '스캔이 감지되어 Enter 를 무시했습니다 — 팝업을 먼저 처리하세요',
          '팝업을 먼저 처리하세요'
        );
        return;
      }
      if (exitOpen) handleExit();
      else handleMarkUnused();
    };
    window.addEventListener('keydown', onKey, true); // 캡처 단계
    return () => window.removeEventListener('keydown', onKey, true);
  }, [exitOpen, unusedOpen, isSubmitting, isScanning, handleExit, handleMarkUnused, notify]);

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
    submitBox: noop,
    moveUp: noop,
    moveDown: noop,
    moveBox: noop,
    help: noop,
    toggleVoice: noop,
    toggleRail: noop,
  });

  // 렌더 중에 ref 를 쓰면 lint 가 막는다 → 매 렌더 뒤 이펙트에서 갱신한다(의존성 배열 없음).
  useEffect(() => {
    handlersRef.current = {
      // 확인 팝업·도움말이 떠 있으면 키는 팝업의 것이다
      enabled: started && !unusedOpen && !exitOpen && !helpOpen,
      busy: isSubmitting || isScanning,
      submit: () => {
        const value = bufferRef.current;
        setScanBuffer('');
        handleScannedValue(value);
      },
      append: (char: string) => setScanBuffer(bufferRef.current + char),
      backspace: () => setScanBuffer(bufferRef.current.slice(0, -1)),
      // 박스를 잡고 있으면 이 박스 취소, 송장 대기면 나갈 차례다 (D3)
      cancel: () => (scanResult ? handleCancelBox() : setExitOpen(true)),
      unused: () => {
        if (scanResult) setUnusedOpen(true);
      },
      selectCandidate: handleSelectCandidate,
      submitBox: handleComplete,
      moveUp: () => (scanResult ? moveRow(-1) : moveParcel(-1)),
      moveDown: () => (scanResult ? moveRow(1) : moveParcel(1)),
      moveBox,
      help: () => setHelpOpen(true),
      toggleVoice,
      toggleRail: toggleRailTab,
    };
  });

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const handlers = handlersRef.current;
      if (!handlers.enabled) return;

      const target = event.target as HTMLElement | null;
      const tag = target?.tagName;
      // 🔴 버튼에 포커스가 있어도 Enter 는 이 페이지의 것이다(D5). 넘겨주면 글자는 버퍼에 쌓인 채
      //    Enter 만 버튼이 먹어서 스캔이 통째로 허공으로 간다. 전체 상자 목록은 ← → 가 고른다.

      // 🔴 스캐너는 문자 + Enter 만 보낸다 → F키와 절대 충돌하지 않는다.
      //    브라우저 기본 동작(F1 = 도움말)은 여기서 막는다. F5·F11·F12 는 건드리지 않는다
      //    (2609_53/D7 — F10 만 부분 번복해 오른쪽 탭에 쓴다: 2609_55/D6).
      if (/^(?:F[1-46-9]|F10)$/.test(event.key)) {
        event.preventDefault();
        if (event.key === 'F8') {
          handlers.help(); // 도움말은 전송 중에도 열린다
          return;
        }
        if (handlers.busy) return;
        if (event.key === 'F4') handlers.unused();
        else if (event.key === 'F6') handlers.submitBox();
        else if (event.key === 'F7') handlers.cancel();
        else if (event.key === 'F9') handlers.toggleVoice();
        // 🔴 마지막 else 는 `F숫자` 를 상자 후보로 읽는다 — F10 을 흘리면 10번째 후보를 고르려 든다
        else if (event.key === 'F10') handlers.toggleRail();
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
      // 🔴 선택 표시만 옮긴다 — `focus()` 를 부르지 않는다 (D5)
      if (event.key.startsWith('Arrow')) {
        event.preventDefault();
        if (handlers.busy) return;
        if (event.key === 'ArrowUp') handlers.moveUp();
        else if (event.key === 'ArrowDown') handlers.moveDown();
        else if (event.key === 'ArrowLeft') handlers.moveBox(-1);
        else if (event.key === 'ArrowRight') handlers.moveBox(1);
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

  /**
   * 🔴 두 갈래(시작 화면 · 몰입 레이어)가 **함께 쓰는** 조각들은 여기서 한 번만 만든다.
   * 양쪽에 복사하면 같은 확인창이 두 개 뜨고 목록 상태가 갈라진다.
   */
  const startCard = (
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
  );

  /**
   * 4-0 ① 스캔 입력 — 🔴 **인스턴스는 화면에 하나**다. 상태마다 JSX 를 다시 적으면 상태가 바뀔 때
   * 컴포넌트가 다시 마운트되어 수동 입력칸에 쳐 둔 글자가 날아간다. 버퍼의 주인은 계속 이 페이지
   * 하나다(2609_40/D9). `mode` 만 송장 ↔ 물품으로 바뀐다.
   */
  const scanInput = (
    <ScanInput
      mode={scanResult && isPending ? 'ITEM' : 'INVOICE'}
      buffer={buffer}
      disabled={isSubmitting}
      isScanning={isScanning}
      onScan={handleScannedValue}
    />
  );

  /**
   * 4-0 ② 박스 정보 — 송장·고객·택배사·순번·판매자·주문번호(담는 중이면 담음 배지까지).
   *
   * 🔴 **항상 그린다**(2609_55/D2). 카드가 생겼다 사라지면 아래 3열과 하단 줄이 통째로 위아래로
   * 밀린다 — 이 화면이 없애려는 밀림이다. 대기 중에는 송장번호 자리에 안내 문구만 들어간다.
   * 🔴 `min-h-[3.25rem]` = 담는 중 줄이 1280px 에서 두 줄로 접혀도 대기 줄과 높이가 같게 한다.
   *    최대 높이를 주거나 `overflow-hidden` 으로 자르지 말 것 — 송장·고객은 작업자가 실물과
   *    대조하는 값이라 가려지면 안 된다.
   */
  const parcelHeader = (
    <Card>
      <div className="flex min-h-[3.25rem] flex-wrap items-center gap-x-6 gap-y-2">
        {!parcel ? (
          <span className="text-2xl font-bold text-gray-400">송장을 스캔하세요</span>
        ) : (
          <>
            <span className="font-mono text-2xl font-bold tabular-nums text-gray-900">
              {parcel.invoiceNumber}
            </span>
            {/* 🔴 수취인 ?? 주문자 — 어느 쪽을 보일지는 화면이 정한다(2609_54/D5). 마스킹하지 않는다:
                작업자가 실물 송장의 받는 사람과 대조하는 값이다 */}
            <span className="text-xl font-semibold text-gray-900">
              {scanResult?.order.receiverName ?? scanResult?.order.ordererName ?? '-'}
            </span>
            <span className="text-sm text-gray-500">{parcel.carrierName ?? '택배사 미상'}</span>
            <span className="text-sm text-gray-500">
              {parcel.totalParcels > 1
                ? `${parcel.totalParcels}박스 중 ${parcel.parcelSeq ?? '-'}번째`
                : '1박스'}
            </span>
            <span className="text-sm text-gray-500">
              {scanResult?.order.sellerName ?? '-'} · 주문 {scanResult?.order.externalOrderId}
            </span>
            {scanResult?.isLastParcel && (
              <span className="rounded bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
                마지막 박스 — 남은 물품 전량을 담아야 합니다
              </span>
            )}
            {isPending && (
              <span
                className={`ml-auto rounded px-3 py-1 text-lg font-semibold ${
                  packedTotal >= remainingTotal
                    ? 'bg-green-100 text-green-700'
                    : 'bg-gray-100 text-gray-700'
                }`}
              >
                담음 {packedTotal} / {remainingTotal}
              </span>
            )}
          </>
        )}
      </div>
    </Card>
  );

  /**
   * 4-0 ③ 안내문 — 🔴 **세 상태 모두 같은 자리**(상단 바 바로 아래, 열 위 전체 폭)에 둔다.
   * 미등록 송장 · 이미 출고된 박스 · 구성 물품 전개 불가는 **송장 대기 상태에서** 뜬다.
   * 자리가 상태마다 움직이면 작업자가 눈을 어디에 둘지 배울 수 없다.
   */
  const messageBar = message && (
    <div className={`rounded border px-4 py-3 text-sm ${TONE_CLASS[message.tone]}`}>
      {message.text}
    </div>
  );

  /** 진행 바 — 담음 / 필요 (2609_54/D1) */
  const progressPercent =
    remainingTotal > 0 ? Math.min(100, Math.round((packedTotal / remainingTotal) * 100)) : 0;

  /**
   * 왼쪽 열(담는 중) — 지금 고른 상자를 화면에서 가장 크게. 🔴 무게·완충재·결제 방식은 넣지 않는다(D8):
   * 시스템에 그 개념이 없다. 빈 자리도 만들지 않는다.
   *
   * 🔴 이 조각은 `scanResult` 가 있을 때만 쓰이지만 선언은 **항상 평가된다** — 안에서 `scanResult` 를
   * 읽는 자리(`selectedBox` 등)는 이미 옵셔널을 거치고 있다. 새 `?.` 를 덧붙이며 조건을 바꾸지 않는다.
   */
  const boxCard = (
    <Card title="이 박스에 담기" className="space-y-3">
      {selectedBox ? (
        <div>
          <div className="text-4xl font-bold text-gray-900">{selectedBox.type}</div>
          <div className="mt-1 text-sm text-gray-500">
            {selectedBox.widthCm} × {selectedBox.lengthCm} × {selectedBox.heightCm} cm
          </div>
          <div className="text-sm text-gray-500">{BOX_KIND_LABEL[boxKindOf(selectedBox)]}</div>
        </div>
      ) : (
        <div className="text-xl text-gray-500">상자를 고르세요</div>
      )}

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
            전체 상자에서 고르세요 (← →). 고른 상자는 이 조합으로 기억됩니다.
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
                  <div className="truncate text-sm font-medium text-gray-900">{pkg.type}</div>
                  <div className="text-xs text-gray-500">
                    {pkg.widthCm} × {pkg.lengthCm} × {pkg.heightCm} cm
                  </div>
                  <div className="text-xs text-gray-500">{BOX_KIND_LABEL[boxKindOf(pkg)]}</div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      <p className="text-sm text-gray-500">상자 = F1 · F2 · F3 또는 ← →</p>
    </Card>
  );

  /** 상자를 아직 고를 수 없는 상태(송장 대기 · 닫힌 박스)의 왼쪽 열 — 자리만 지킨다 (2609_55/D4) */
  const boxPlaceholderCard = (
    <Card title="이 박스에 담기">
      <p className="text-sm text-gray-500">송장을 스캔하면 상자를 추천합니다.</p>
    </Card>
  );

  /**
   * 가운데 열(담는 중) — 🔴 `scanInput` 을 빼지 말 것: 스캐너가 없을 때 물품을 손으로 넣는 유일한
   * 창구이고, 스캔 버퍼가 보이는 유일한 자리다.
   */
  const productCard = (
    <Card title="제품 스캔" className="space-y-4">
      {scanInput}

      <PackingItemList
        items={rows}
        activeRowKey={activeRowKey}
        onQuantityChange={handleQuantityChange}
      />

      <div className="h-2 rounded bg-gray-200">
        <div className="h-2 rounded bg-green-500" style={{ width: `${progressPercent}%` }} />
      </div>

      {/* 🔴 문구를 「발송 완료」로 바꾸지 말 것(2609_54/D9) — 이 시스템의 발송처리는 채널에
          송장을 올리는 일(2609_07)이고 포장 완료와 다른 일이다 */}
      <div className="flex gap-3">
        <Button
          className="flex-1"
          onClick={handleComplete}
          isLoading={isSubmitting}
          loadingText="완료 처리 중..."
        >
          [Enter · F6] 이 박스 완료
        </Button>
        <Button
          className="flex-1"
          variant="secondary"
          onClick={handleCancelBox}
          disabled={isSubmitting}
        >
          [Esc · F7] 취소
        </Button>
      </div>
    </Card>
  );

  // ── 열 단위 조각 — 🔴 자리는 여기서만 정해진다 (2609_55/D1) ─────────────────

  const leftColumn = scanResult && isPending ? boxCard : boxPlaceholderCard;

  /**
   * 가운데 열 — 세 상태가 **같은 자리**를 쓴다. 🔴 `scanInput` 인스턴스는 여전히 화면에 하나다
   * (2609_40/D9) — 아래 분기에서 두 갈래가 동시에 그려지지 않는다.
   *
   * 🔴 닫힌 박스에는 스캔 입력칸을 두지 않는다(2609_55/D10): 이 상태의 스캔은 거부되므로 받을 수
   * 없는 입력을 받을 것처럼 보이면 안 된다. 거부 메시지(`handleScannedValue`)는 손대지 않는다.
   */
  const centerColumn = !scanResult ? (
    /* 송장 대기 — 큰 스캔 영역 (2609_54/D10) */
    <Card title="송장을 스캔하세요" className="space-y-4">
      <div className="flex justify-center py-4">
        <ScanLine size={96} className="text-gray-300" />
      </div>
      {scanInput}
      <p className="text-center text-sm text-gray-500">남은 주문 {pendingParcels.length}건</p>
    </Card>
  ) : isPending ? (
    productCard
  ) : (
    /* 닫힌 박스 — 제목이 상태를 말하고 본문은 버튼 하나. 같은 문장을 본문에 또 적지 않는다(안내문 자리에 이미 떠 있다) */
    <Card title={scanResult.parcel.status === 'PACKED' ? '출고 완료된 박스' : '사용하지 않은 박스'}>
      <Button variant="secondary" onClick={handleCancelBox} disabled={isSubmitting}>
        [Esc] 다음 송장 스캔
      </Button>
    </Card>
  );

  /**
   * 오른쪽 열 — 「작업 대상」 · 「오늘 완료」 탭 (2609_55/D5). 🔴 세 상태 모두 항상 그린다.
   * 🔴 박스를 잡고 있으면 작업 대상 목록은 **보이지만 조작 대상이 아니다**(D7): 고른 줄 표시도,
   * 줄 열기도 없다 — 담고 있던 것을 날리지 않기 위해서다.
   */
  const rightRail = (
    <RightRailTabs
      tab={railTab}
      onSelectTab={setRailTab}
      pendingPanel={
        <PendingParcelList
          parcels={pendingParcels}
          loading={pendingLoading}
          compact
          selectedParcelId={started && !scanResult ? selectedParcelId : null}
          onOpen={scanResult ? null : (invoiceNumber) => handleInvoiceScan(invoiceNumber)}
        />
      }
    />
  );

  /**
   * 하단 유틸리티 줄 — 🔴 세 상태 모두 같은 자리에 **항상** 그린다(2609_55/D9). 지우면 기능이 사라진다.
   *
   * ⚠️ `F4` **버튼**은 담는 중에만 활성이지만 **키**(`handlers.unused`)는 닫힌 박스에서도 팝업을 연다.
   * 이 불일치는 지금 코드에 이미 있던 것이고, 키를 고치는 것은 조작 변경이라 여기서 맞추지 않는다.
   * 적어 두는 이유는 다음 사람이 "둘이 다른데 어느 쪽이 맞나"로 시간을 쓰지 않게 하려는 것이다.
   */
  const utilityRow = (
    <div className="flex flex-wrap items-center gap-2">
      <Button
        size="sm"
        variant="danger"
        onClick={() => setUnusedOpen(true)}
        disabled={!scanResult || !isPending || isSubmitting}
      >
        [F4] 이 박스 사용 안 함
      </Button>
      <Button size="sm" variant="secondary" onClick={() => setHelpOpen(true)}>
        [F8] 단축키
      </Button>
      <Button size="sm" variant="secondary" onClick={toggleVoice}>
        [F9] 음성 {voiceOn ? '끄기' : '켜기'}
      </Button>
      {/* 🔴 F10 과 **같은 함수**를 쓴다 — 두 곳에 각각 setRailTab 을 적으면 나중에 한쪽만 고쳐진다 */}
      <Button size="sm" variant="secondary" onClick={toggleRailTab}>
        [F10] 오른쪽 탭
      </Button>
      <span className="text-xs text-gray-500">
        담을 것 = ↑ ↓ · 숫자 4자리 이하 + Enter = 고른 줄 수량
      </span>
    </div>
  );

  /**
   * 🔴 시작 화면 전용 전체 폭 목록 — 몰입 레이어 안에서는 쓰지 않는다(그 자리는 오른쪽 탭이 갖는다).
   * 시작 화면은 오른쪽 열이 없는 화면이라 통일 대상이 아니다(2609_55/D11).
   */
  const parcelListSection = (
    <div>
      <h2 className="mb-2 font-semibold text-gray-900">작업 대상 박스</h2>
      {/* 🔴 선택 표시는 몰입 중일 때만. 시작 화면은 전역 키가 꺼져 있어(enabled: started)
          ↑↓ 로 움직일 수 없는 파란 줄만 남는다 */}
      <PendingParcelList
        parcels={pendingParcels}
        loading={pendingLoading}
        selectedParcelId={started ? selectedParcelId : null}
        onOpen={(invoiceNumber) => {
          if (!started) setStarted(true);
          handleInvoiceScan(invoiceNumber);
        }}
      />
    </div>
  );

  const dialogs = (
    <>
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

      <ConfirmDialog
        isOpen={exitOpen}
        title="포장 작업 나가기"
        message={
          scanResult
            ? '담고 있던 박스가 있습니다. 나가면 담은 내용은 저장되지 않습니다. [Enter] 나가기 · [Esc] 돌아가기'
            : '포장 작업을 끝내고 시작 화면으로 돌아갑니다. [Enter] 나가기 · [Esc] 돌아가기'
        }
        confirmText="나가기"
        cancelText="돌아가기"
        onConfirm={handleExit}
        onCancel={() => setExitOpen(false)}
        isDangerous={!!scanResult}
      />

      <Modal
        isOpen={helpOpen}
        onClose={() => setHelpOpen(false)}
        title="단축키"
        footer={<Button onClick={() => setHelpOpen(false)}>확인</Button>}
      >
        <table className="w-full text-sm">
          <tbody>
            {SHORTCUT_HELP.map(([keys, what]) => (
              <tr key={keys} className="border-b border-gray-100 last:border-b-0">
                <td className="w-56 py-2 pr-4 align-top font-medium text-gray-900">{keys}</td>
                <td className="py-2 text-gray-700">{what}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Modal>
    </>
  );

  if (!started) {
    return (
      <PageContainer title="포장 작업">
        {startCard}
        {parcelListSection}
        {dialogs}
      </PageContainer>
    );
  }

  /**
   * 몰입 레이어 — 사이드바·상단바를 덮는다 (D1 · D9).
   *
   * `z-50` 은 사이드바와 같은 값이지만 페이지가 DOM 뒤쪽(`<main>` 안)이라 위에 덮인다.
   * 팝업은 body 끝 portal 이라 이 레이어보다 위에 뜬다 — 🔴 `z-[60]` 이상을 쓰지 말 것.
   * 폭은 `CONTENT_WIDTH` 에서 온다(D10) — 손으로 `max-w-7xl` 을 적지 않는다.
   */
  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-page p-4 md:p-6">
      <div className={`${CONTENT_WIDTH} space-y-4`}>
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900">포장 작업</h1>
          <span className="text-sm text-gray-500">[Esc] 나가기 · [F8] 단축키</span>
        </div>
        {parcelHeader}
        {messageBar}
        {/* 🔴 자리를 정하는 곳은 여기 하나다 — 이 문자열이 화면에 두 번 나오면 통일이 깨진 것이다 */}
        <div className="grid gap-4 xl:grid-cols-[22rem_1fr_20rem]">
          {leftColumn}
          {centerColumn}
          {rightRail}
        </div>
        {utilityRow}
      </div>
      {dialogs}
    </div>
  );
}
