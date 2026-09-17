'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import axios from 'axios';
import { ScanLine } from 'lucide-react';
import { PageContainer } from '@/presentation/components/PageContainer';
import { useThemeStore } from '@/infrastructure/stores/themeStore';
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
 * 따로 들고 있으면 상태가 자리를 흔든다. `xl:grid-cols-[26rem_1fr_20rem]` 은 이 파일에 한 번만 나온다.
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
 * 통째로 깨진다. 🔴 몰입 레이어는 **디스플레이를 꽉 채운다** — 폭도 높이도 제한하지 않는다.
 * `CONTENT_WIDTH`(`max-w-7xl`)를 다시 씌우지 말 것: 넓은 현장 PC 에서 양옆이 죽는다.
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

/**
 * 메시지 창 **카드 면 전체**의 색. 🔴 안쪽에 작은 띠(스낵바 모양)를 만들지 않는다 —
 * 작업자는 서서 1~2초만 보기 때문에 「색이 바뀐 면」이 「작은 띠」보다 훨씬 빨리 읽힌다.
 * 오류는 채운 빨강이다. 연한 배경 + 빨간 글씨로는 몇 미터 떨어진 작업대에서 구분이 안 된다.
 */
/**
 * 플랫폼 enum → 화면 이름. 🔴 모르는 값은 **원문 그대로** 보여준다(빈칸보다 낫다) —
 * 새 채널이 붙었을 때 화면이 조용히 비지 않게.
 */
const PLATFORM_LABEL: Record<string, string> = {
  COUPANG: '쿠팡',
  NAVER: '네이버',
};

const TONE_LABEL: Record<MessageTone, string> = {
  info: '상태 메시지',
  error: '오류',
  success: '완료',
};

const TONE_PANEL_CLASS: Record<MessageTone, string> = {
  info: 'bg-gray-100 text-gray-800',
  error: 'bg-red-600 text-white',
  success: 'bg-green-600 text-white',
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
  /**
   * Ctrl + Alt + D — 라이트 ↔ 다크 (2026-09-16 사용자 지시).
   *
   * 🔴 F키를 쓰지 않는다: F1~F4·F6~F10 은 전부 임자가 있고 `F5 · F11 · F12` 는 건드리지 않기로 한
   * 규칙(2609_53/D7)이 남아 있다. 조합키는 **스캐너가 절대 보내지 않으므로**(문자 + Enter 만 보낸다)
   * 스캔과 충돌하지 않는다. 브라우저 기본 동작도 없는 조합이다.
   */
  toggleTheme: () => void;
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
  ['F4', '송장 미사용 처리'],
  ['F6 / F7', '이 박스 완료 / 취소'],
  ['F8 / F9', '단축키 / 안내 음성'],
  ['F10', '오른쪽 열 탭 (작업 대상 / 오늘 완료)'],
  ['Ctrl + Alt + D', '라이트 ↔ 다크 모드'],
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

  /** 라이트 ↔ 다크. 몰입 레이어가 상단 바를 덮으므로 이 화면 안에 전환 창구가 따로 필요하다 */
  const theme = useThemeStore((state) => state.theme);
  const toggleTheme = useThemeStore((state) => state.toggleTheme);

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
  /**
   * 메시지 + 그 메시지의 일련번호 (2026-09-16 사용자 지시 — 바뀔 때마다 한 번 깜빡인다).
   *
   * 🔴 번호는 메시지 **안에** 둔다. 별도 state + 이펙트로 세면 `react-hooks/set-state-in-effect`
   * (이 저장소 lint 규칙, error)에 걸린다.
   * 🔴 번호가 필요한 이유 = CSS 애니메이션은 클래스를 다시 붙여도 되돌아오지 않는다. `key` 를 바꿔
   * 엘리먼트를 갈아끼워야 처음부터 다시 돈다. 같은 문구가 연달아 떠도 번호가 올라가 깜빡인다.
   */
  const [message, setMessageState] = useState<{
    tone: MessageTone;
    text: string;
    seq: number;
  } | null>(null);
  const messageSeqRef = useRef(0);

  /** 🔴 기존 호출부(`setMessage({tone,text})` · `setMessage(null)`)를 그대로 두기 위한 껍데기다 */
  const setMessage = useCallback((next: { tone: MessageTone; text: string } | null) => {
    messageSeqRef.current += 1;
    setMessageState(next ? { ...next, seq: messageSeqRef.current } : null);
  }, []);

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
    [speak, setMessage]
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
  }, [setMessage]);

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

  /** 이 박스에 담을 것을 다 담았는가 — 완료 배지·진행바가 같은 값을 본다 */
  const allPacked = remainingTotal > 0 && packedTotal >= remainingTotal;

  /**
   * 이 박스가 **마지막 박스**인가 — 서버 판정이다(2609_40/D13).
   * 🔴 `totalParcels`·`parcelSeq` 로 프론트가 다시 계산하지 않는다: 앞 박스가 취소되면 번호와
   *    실제 마지막 여부가 어긋난다.
   */
  const isLastParcel = scanResult?.isLastParcel === true;

  /**
   * [이 박스 완료] 를 누를 수 있는가 — 🔴 `handleComplete` 의 검문과 **같은 규칙**이어야 한다
   * (2026-09-17 사용자 결정). 버튼만 더 빡빡하게 걸면 분할 배송의 앞 박스를 영영 닫을 수 없다.
   * ① 아무것도 안 담았으면 불가(닫을 것이 없다 — 빈 박스는 `[F4]` 소관)
   * ② 마지막 박스면 **전량**을 담아야 한다
   * ③ 마지막이 아니면 담은 만큼 닫는다 — 나머지는 다음 송장이 받는다
   */
  const canComplete = packedTotal > 0 && (allPacked || !isLastParcel);

  /**
   * 상자 후보를 물을 조합 — 키는 물품 × 수량뿐이다(D22). 여러 라인의 같은 물품은 합친다.
   *
   * 🔴 **이 박스에 담아야 할 전량**(`remainingQty`)으로 만든다(2026-09-17 사용자 지시).
   *    담은 수량(`packedQty`)으로 만들면 물품을 찍을 때마다 조합이 바뀌어 추천 상자가 계속
   *    갈아치워지고, 정작 **송장을 찍은 직후에는 조합이 비어 있어 추천이 없다.** 작업자는
   *    물품을 담기 전에 상자부터 집어야 한다.
   * 🔴 그래서 `rows` 가 아니라 `scanResult` 를 본다 — `rows` 는 담을 때마다 새로 만들어져서
   *    이 값이 같아도 참조가 바뀌고, 그러면 아래 조회 이펙트가 매번 다시 돈다.
   */
  const compositionItems: BoxCandidateItem[] = useMemo(() => {
    if (!scanResult) return [];
    const byProduct = new Map<number, number>();
    scanResult.remaining.forEach((item) => {
      if (item.remainingQty <= 0) return;
      byProduct.set(item.productId, (byProduct.get(item.productId) ?? 0) + item.remainingQty);
    });
    return [...byProduct.entries()].map(([productId, quantity]) => ({ productId, quantity }));
  }, [scanResult]);

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

  /**
   * 송장을 찍으면 **한 번** 후보를 묻는다 (D23 · 2026-09-17 사용자 지시).
   * 🔴 담는 동안에는 다시 묻지 않는다 — `compositionKey` 가 이 박스의 전량이라 바뀌지 않는다.
   */
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
          notify('error', '미사용 처리된 송장입니다', '미사용 처리된 송장입니다');
        } else if (result.unexpanded.length > 0) {
          notify(
            'error',
            '구성 물품을 전개할 수 없는 주문입니다 — 이 박스는 완료할 수 없습니다',
            '구성 물품을 전개할 수 없습니다'
          );
        } else if (result.remaining.length === 0) {
          notify(
            'info',
            '담을 물품이 없습니다 — [F4] 송장 미사용 처리로 닫으세요',
            '담을 물품이 없습니다'
          );
        } else {
          // 문제 없이 열린 경우에도 메시지 창은 비워 두지 않는다 — 스캔이 먹었다는 것을 눈으로 알려 준다.
          // 🔴 음성은 붙이지 않는다: 정상 스캔마다 말하면 정작 오류 음성이 묻힌다.
          notify('success', `송장을 스캔했습니다 — ${result.parcel.invoiceNumber}`);
        }
      } catch (error) {
        const notFound = axios.isAxiosError(error) && error.response?.status === 404;
        const text = notFound
          ? '유효하지 않은 송장번호입니다 — 아직 발송처리 전이거나 주문 동기화가 필요합니다'
          : serverMessage(error, '송장 조회에 실패했습니다');
        notify('error', text, notFound ? '유효하지 않은 송장번호입니다' : text);
      } finally {
        setIsScanning(false);
      }
    },
    [packingUseCase, notify, setMessage]
  );

  const addOne = useCallback((row: PackedRow) => {
    const key = rowKey(row.orderLineId, row.productId);
    setPacked((previous) => ({ ...previous, [key]: (previous[key] ?? 0) + 1 }));
    setActiveRowKey(key);
    setMessage(null);
  }, [setMessage]);

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
    [activeRowKey, rows, notify, setMessage]
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
        scanResult.parcel.status === 'PACKED' ? '이미 출고된 박스입니다' : '미사용 처리된 송장입니다'
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
        '담을 물품이 없습니다 — [F4] 송장 미사용 처리로 닫으세요',
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
      notify('success', '송장을 미사용 처리했습니다', '미사용 처리했습니다');
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
  }, [resetBox, setMessage]);

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

  /**
   * Ctrl + Alt + D · 하단 버튼 — 라이트 ↔ 다크. 🔴 두 길이 같은 함수를 쓴다.
   *
   * 색은 이 페이지가 고르지 않는다 — 전역 `themeStore` 가 `<html>` 에 `.dark` 를 붙이고 색은
   * `globals.css` 의 `.dark` 블록 한 곳에서 나온다. 여기에 다크 색을 하드코딩하지 말 것.
   * 바뀐 결과는 메시지 창에 남긴다: 몰입 레이어가 상단 바를 덮어 테마 버튼이 안 보이기 때문에
   * 방금 무엇이 바뀌었는지 말해 주는 자리가 여기밖에 없다.
   */
  const switchTheme = useCallback(() => {
    toggleTheme();
    setMessage({
      tone: 'info',
      text: theme === 'dark' ? '라이트 모드로 바꿨습니다' : '다크 모드로 바꿨습니다',
    });
  }, [theme, toggleTheme, setMessage]);

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
            : '미사용 처리된 송장입니다 — [Esc] 로 취소하고 다음 송장을 스캔하세요'
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
    toggleTheme: noop,
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
      toggleTheme: switchTheme,
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

      /*
       * 🔴 Ctrl(또는 ⌘) + Alt + D = 라이트 ↔ 다크. **조합키 검사는 아래 `modifier return` 보다
       *    먼저**여야 한다 — 그 줄이 조합키를 전부 흘려보낸다.
       * 🔴 `event.key` 가 아니라 `event.code` 로 본다: macOS 에서 Alt + D 는 `key` 가 `'∂'` 로 온다.
       * 🔴 입력칸에 포커스가 있어도 받는다(테마는 글자가 아니다). 전송 중(`busy`)에도 받는다 —
       *    색만 바뀔 뿐 아무 것도 보내지 않는다.
       */
      if ((event.ctrlKey || event.metaKey) && event.altKey && event.code === 'KeyD') {
        event.preventDefault();
        handlers.toggleTheme();
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

  /** 채널 표시 — 별칭이 있으면 그것이 더 구체적이다(같은 플랫폼에 계정이 여럿) */
  const channelLabel =
    scanResult?.order.accountAlias?.trim() ||
    PLATFORM_LABEL[scanResult?.order.platform ?? ''] ||
    scanResult?.order.platform ||
    '-';

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
      /* 🔴 닫힌 박스에서는 꺼 둔다(2609_55/D10 의 취지): 이 상태의 스캔은 거부되므로 받을 수 없는
         입력을 받을 것처럼 보이면 안 된다. 거부 판정 자체(`handleScannedValue`)는 손대지 않는다 */
      disabled={isSubmitting || (!!scanResult && !isPending)}
      isScanning={isScanning}
    />
  );

  /**
   * 4-0 ② 송장 정보 — 송장번호(제일 큼) · 라벨 붙은 값들 · 분할 배송 안내.
   *
   * 🔴 **항상 그린다**(2609_55/D2). 카드가 생겼다 사라지면 아래 3열과 하단 줄이 통째로 위아래로
   * 밀린다 — 이 화면이 없애려는 밀림이다. 대기 중에는 송장번호 자리에 안내 문구만 들어간다.
   * 🔴 값마다 **라벨을 붙인다**(2026-09-17 사용자 지시). 라벨 없이 나열하면 「쿠팡」이 판매자인지
   *    채널인지 작업자가 추측해야 한다. 판매자·채널은 한 단계 크게 — 어느 가게 물건인지가
   *    포장·송장 규칙을 가르는 값이다.
   * 🔴 **담음 N / 필요 N 을 여기에 두지 않는다**(2026-09-17 사용자 지시). 그것은 송장의 성질이
   *    아니라 **작업 진행 상황**이라 「발송 상품 목록」 카드(진행 바 · 담기 완료 배지)의 것이다.
   * 🔴 `min-h-[3.25rem]` 은 대기 줄과 높이를 맞춘다. 최대 높이를 주거나 `overflow-hidden` 으로
   *    자르지 말 것 — 송장·수취인은 작업자가 실물과 대조하는 값이라 가려지면 안 된다.
   */
  const headerField = (label: string, value: string, strong = false) => (
    <div className="min-w-0">
      <div className="text-xs font-medium uppercase tracking-wide text-gray-700">{label}</div>
      <div
        className={`truncate ${strong ? 'text-xl font-bold text-gray-900' : 'text-base font-semibold text-gray-900'}`}
        title={value}
      >
        {value}
      </div>
    </div>
  );

  const parcelHeader = (
    <Card className="h-full space-y-4">
      <div className="min-h-[3.25rem]">
        {!parcel ? (
          /* 🔴 대기 중에도 **같은 골격**을 그린다(2026-09-17 사용자 지시) — 값만 `-` 다.
             안내 한 줄만 그리면 스캔하는 순간 이 카드가 세 줄만큼 커지면서 아래 3열이 통째로
             밀려 내려간다. 이 화면이 없애려던 밀림이다. */
          <div className="space-y-3">
            <span className="text-2xl font-bold text-gray-600">송장 바코드를 스캔해 주세요</span>
            <div className="grid grid-cols-2 gap-x-6 gap-y-3 border-t border-gray-100 pt-3 sm:grid-cols-3">
              {headerField('판매자', '-', true)}
              {headerField('채널', '-', true)}
              {headerField('수취인', '-')}
              {headerField('주문번호', '-')}
              {headerField('택배사', '-')}
              {headerField('박스', '-')}
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {/* 송장번호 = 실물과 맞춰 보는 값이라 제일 크게. 등폭 숫자로 자릿수를 세기 쉽게 */}
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
              <span className="font-mono text-2xl font-bold tabular-nums text-gray-900">
                {parcel.invoiceNumber}
              </span>
              {/* 🔴 분할 배송은 박스마다 규칙이 다르다 — 어느 쪽인지 **송장 정보 칸에서** 알려준다
                  (2026-09-17 사용자 결정). 앞 박스는 담을 만큼만, 나머지는 전량이다.
                  🔴 「마지막 박스」라는 말을 쓰지 않는다(2026-09-17 사용자 지시): 한 박스짜리
                  주문에도 붙어 자연스럽지 않았다. 작업자에게 필요한 것은 순번이 아니라 **할 일**이다. */}
              {isLastParcel ? (
                <span className="rounded bg-amber-100 px-3 py-1 text-sm font-medium text-amber-800">
                  발송 상품 목록 내 물품을 모두 포장해야 합니다.
                </span>
              ) : (
                parcel.totalParcels > 1 && (
                  <span className="rounded bg-blue-100 px-3 py-1 text-sm font-medium text-blue-800">
                    분할 배송 상품입니다 — 이 박스에 담을 만큼만 담으세요
                  </span>
                )
              )}
            </div>

            <div className="grid grid-cols-2 gap-x-6 gap-y-3 border-t border-gray-100 pt-3 sm:grid-cols-3">
              {headerField('판매자', scanResult?.order.sellerName ?? '-', true)}
              {/* 🔴 채널 = 별칭 ?? 플랫폼 — **무엇을 보일지는 화면이 정한다**(수취인/주문자와 같은 규칙).
                  같은 채널에 계정이 여럿이면 별칭이 그 계정을 가리키고, 없으면 플랫폼 이름이 남는다. */}
              {headerField('채널', channelLabel, true)}
              {headerField(
                '수취인',
                /* 🔴 수취인 ?? 주문자 (2609_54/D5). 마스킹하지 않는다 — 작업자가 실물 송장의
                   받는 사람과 대조하는 값이다 */
                scanResult?.order.receiverName ?? scanResult?.order.ordererName ?? '-'
              )}
              {headerField('주문번호', scanResult?.order.externalOrderId ?? '-')}
              {headerField('택배사', parcel.carrierName ?? '택배사 미상')}
              {headerField(
                '박스',
                parcel.totalParcels > 1
                  ? `${parcel.totalParcels}박스 중 ${parcel.parcelSeq ?? '-'}번째`
                  : '1박스'
              )}
            </div>
          </div>
        )}
      </div>

      {/* 🔴 [F4] 는 **송장 정보 칸**에 있다(2026-09-17 사용자 지시) — 이 동작의 대상은 상자(규격)가
          아니라 **이 송장 한 장**이다. 「박스 추천」 카드 안에 두었더니 추천을 안 쓴다는 뜻으로 읽혔다.
          🔴 자리를 지키려고 **항상 그린다**(대기 중에는 비활성). 버튼이 생겼다 사라지면 이 카드
          높이가 바뀌어 아래 3열이 밀린다.
          🔴 키(`handlers.unused`)는 그대로다. 버튼을 옮겨도 조작은 바뀌지 않는다. */}
      <div className="flex justify-end border-t border-gray-100 pt-3">
        <Button
          size="lg"
          variant="danger"
          onClick={() => setUnusedOpen(true)}
          disabled={!scanResult || !isPending || isSubmitting}
        >
          [F4] 송장 미사용 처리
        </Button>
      </div>

      {/* 🔴 여기 스캔칸은 **송장용**이다. 물품 스캔칸은 「발송 상품 목록」 카드 맨 위에 있다
          (2026-09-17 사용자 지시) — 담는 동안 눈이 머무는 카드가 그쪽이다.
          🔴 두 자리에 동시에 그리지 않는다. 화면에 있는 인스턴스는 언제나 하나다(2609_40/D9).
          🔴 담는 중에도 **자리는 비워 둔다**(`min-h-14` = 스캔칸 높이). 칸이 사라지면 이 줄이
          짧아지면서 아래 3열이 통째로 위로 올라간다 — 이 화면이 없애려던 밀림이다. */}
      <div className="min-h-14">{!isPending && scanInput}</div>
    </Card>
  );

  /** 송장을 기다리는 중 = 스캔 카드를 깜빡여 눈을 끈다 (2026-09-16 사용자 지시) */
  const awaitingInvoice = !scanResult;

  /**
   * 🔴 깜빡임은 `Card` **바깥 래퍼**가 맡는다 — `Card` 의 `className` 으로 `shadow-*` 를
   * 덮어쓰지 않기 위해서다(Card.tsx 규칙). 애니메이션은 `globals.css` 의 `.packing-scan-blink`.
   */
  const scanCard = (
    <div className={awaitingInvoice ? 'packing-scan-blink' : undefined}>{parcelHeader}</div>
  );

  /**
   * 4-0 ③ 메시지 창 — 상단 정보 줄 **오른쪽 카드**. 오류와 상태 메시지가 여기에만 뜬다
   * (2026-09-16 사용자 지시).
   *
   * 🔴 **떠 있다 사라지는 알림(스낵바)을 쓰지 않는다.** 작업자는 서 있고 눈은 1~2초만 화면에 준다 —
   *    메시지가 사라지고 나면 방금 무엇이 잘못됐는지 확인할 방법이 없다. 자리를 고정하고 **마지막
   *    메시지를 그대로 남긴다.**
   * 🔴 메시지가 없어도 카드는 그린다. 높이도 고정이다(`h-[4.5rem]` + 안쪽 스크롤) — 긴 오류 문구가
   *    줄을 늘려 아래 3열을 밀어 내리면 이 화면이 없애려던 밀림이 그대로 돌아온다.
   */
  const messagePanel = (
    /*
     * 🔴 `padded={false}` + 안쪽 `rounded-lg` — 색이 카드 **면 전체**를 덮게 하는 방법이다.
     *    `Card` 의 `className` 으로 `bg-*` 를 덮어쓰지 않는다(Card.tsx 규칙).
     * 🔴 `h-full` — 색이 카드 **바닥까지** 찬다. 높이는 왼쪽 스캔 카드가 정하고(같은 줄의 grid stretch)
     *    이쪽은 거기에 맞춰 늘어난다. 🔴 `max-h-*` 를 다시 붙이지 말 것: 색칠 안 된 흰 자투리가 생긴다.
     *    긴 문구는 줄을 늘리는 대신 이 칸 **안에서** 스크롤한다 — 아래 3열을 밀어 내리지 않는다.
     */
    <Card padded={false}>
      <div
        /* 🔴 메시지가 없을 때는 깜빡이지 않는다 — 물품을 찍을 때마다 메시지가 지워지므로
           빈 카드까지 깜빡이면 계속 번쩍인다 */
        key={message?.seq ?? 'empty'}
        className={`flex h-full flex-col gap-2 overflow-y-auto rounded-lg px-6 py-4 ${
          message ? `packing-message-flash ${TONE_PANEL_CLASS[message.tone]}` : 'bg-white'
        }`}
      >
        {/* 왼쪽 위 상태 타이틀 — 왼쪽 카드의 「송장 대기 중」과 같은 자리·같은 역할 */}
        <span className={`text-sm font-semibold ${message ? 'opacity-75' : 'text-gray-600'}`}>
          {message ? TONE_LABEL[message.tone] : '상태 메시지'}
        </span>
        {message ? (
          <span className="text-2xl font-bold leading-snug">{message.text}</span>
        ) : (
          <span className="text-2xl font-bold text-gray-500">메시지 없음</span>
        )}
      </div>
    </Card>
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
    <Card title="박스 추천" className="space-y-3 xl:min-h-0 xl:overflow-y-auto">
      {selectedBox ? (
        <div>
          <div className="text-4xl font-bold text-gray-900">{selectedBox.type}</div>
          <div className="mt-1 text-sm text-gray-700">
            {selectedBox.widthCm} × {selectedBox.lengthCm} × {selectedBox.heightCm} cm
          </div>
          <div className="text-sm text-gray-700">{BOX_KIND_LABEL[boxKindOf(selectedBox)]}</div>
        </div>
      ) : (
        <div className="text-xl text-gray-700">상자를 고르세요</div>
      )}

      {compositionItems.length === 0 ? (
        <p className="text-sm text-gray-700">담을 물품이 없습니다.</p>
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
          <p className="text-sm text-gray-700">
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
                  <div className="text-xs text-gray-700">
                    {pkg.widthCm} × {pkg.lengthCm} × {pkg.heightCm} cm
                  </div>
                  <div className="text-xs text-gray-700">{BOX_KIND_LABEL[boxKindOf(pkg)]}</div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      <p className="text-sm text-gray-700">상자 = F1 · F2 · F3 또는 ← →</p>

    </Card>
  );

  /** 상자를 아직 고를 수 없는 상태(송장 대기 · 닫힌 박스)의 왼쪽 열 — 자리만 지킨다 (2609_55/D4) */
  const boxPlaceholderCard = (
    <Card title="박스 추천" className="space-y-3 xl:min-h-0 xl:overflow-y-auto">
      <p className="text-sm text-gray-700">송장을 스캔하면 상자를 추천합니다.</p>

    </Card>
  );

  /**
   * 가운데 열(담는 중) — 「발송 상품 목록」 · 진행 바 · 완료/취소 버튼.
   *
   * 🔴 스캔 버퍼 칸은 여기 없다. 상단 스캔 카드 한 자리로 올라갔다(2026-09-16 사용자 지시).
   * 스캐너가 없으면 그냥 키보드로 치면 된다 — 전역 키 수신이 받아 그 칸에 쌓인다.
   * 여기에 입력칸을 만들지 말 것: 포커스를 가진 입력칸은 전역 수신을 꺼 버린다(`isFormField` 가드).
   */
  const productCard = (
    <Card
      title="발송 상품 목록"
      /* 🔴 다 담으면 배지로 알린다(2026-09-17 사용자 지시) — 타일을 하나씩 세어 보지 않아도
         「이제 닫아도 된다」가 한눈에 보여야 한다. 상단 정보 줄의 `담음 N / 필요 N` 은 숫자라
         읽어야 알 수 있다. 🔴 `remainingTotal > 0` 가드: 담을 게 없는 박스를 완료로 칠하지 않는다 */
      action={
        allPacked ? (
          <span className="rounded bg-green-600 px-3 py-1 text-lg font-bold text-white">
            담기 완료
          </span>
        ) : undefined
      }
      className="space-y-4 xl:flex xl:min-h-0 xl:flex-col xl:overflow-hidden"
    >
      {/* 🔴 물품 스캔칸은 이 카드 **맨 위**다(2026-09-17 사용자 지시) — 담는 동안 눈이 머무는
          카드가 여기라, 찍는 자리와 결과가 보이는 자리가 같아야 한다.
          🔴 `ScanInput` 은 상태를 갖지 않는다(버퍼는 페이지 소유) — 상태가 바뀌며 이 조각이 다시
          마운트돼도 쳐 둔 글자가 날아가지 않는다. */}
      {scanInput}

      {/* 🔴 늘어나는 칸은 상품 목록 하나다 — 진행바·버튼은 카드 아래쪽에 붙어 있어야 한다 */}
      <div className="xl:min-h-0 xl:flex-1 xl:overflow-y-auto">
        <PackingItemList
          items={rows}
          activeRowKey={activeRowKey}
          onQuantityChange={handleQuantityChange}
        />
      </div>

      <div className="h-2 rounded bg-gray-200">
        <div className="h-2 rounded bg-green-500" style={{ width: `${progressPercent}%` }} />
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
    /*
     * 송장 대기 — 큰 스캔 영역 (2609_54/D10).
     * 🔴 제목을 달지 않는다: 「송장을 스캔하세요」는 **상단 정보 줄에 한 번만** 나온다
     * (2026-09-16 사용자 지시 — 같은 문장이 두 군데 있으면 어느 쪽을 보라는 것인지 알 수 없다).
     * 🔴 남은 주문 건수를 적지 않는다(2026-09-17 사용자 지시): 이 화면은 **지금 이 박스 하나**를
     * 담는 일만 한다. 몇 개가 남았는지는 작업자가 할 수 있는 일이 없는 숫자다.
     */
    <Card className="xl:flex xl:min-h-0 xl:flex-col xl:overflow-y-auto">
      <div className="flex items-center justify-center py-4 xl:min-h-0 xl:flex-1">
        <ScanLine size={96} className="text-gray-500" />
      </div>
    </Card>
  ) : isPending ? (
    productCard
  ) : (
    /* 닫힌 박스 — 제목이 상태를 말하고 본문은 버튼 하나. 같은 문장을 본문에 또 적지 않는다(안내문 자리에 이미 떠 있다) */
    <Card
      title={scanResult.parcel.status === 'PACKED' ? '출고 완료된 박스' : '미사용 처리된 송장'}
      className="xl:min-h-0 xl:overflow-y-auto"
    >
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
   * 🔴 `[F4]` 버튼은 여기 없다 — 「박스 추천」 카드 안으로 옮겼다(2026-09-16 사용자 지시).
   * **키는 그대로** `handlers.unused` 다. 버튼 자리를 옮기는 것과 조작을 바꾸는 것은 다른 일이다.
   * ⚠️ `F4` **버튼**은 담는 중에만 활성이지만 **키**는 닫힌 박스에서도 팝업을 연다. 이 불일치는
   * 지금 코드에 이미 있던 것이고, 키를 고치는 것은 조작 변경이라 여기서 맞추지 않는다.
   */
  const utilityRow = (
    <div className="flex flex-wrap items-center gap-2">
      <Button size="lg" variant="secondary" onClick={() => setHelpOpen(true)}>
        [F8] 단축키
      </Button>
      <Button size="lg" variant="secondary" onClick={toggleVoice}>
        [F9] 음성 {voiceOn ? '끄기' : '켜기'}
      </Button>
      {/* 🔴 F10 과 **같은 함수**를 쓴다 — 두 곳에 각각 setRailTab 을 적으면 나중에 한쪽만 고쳐진다 */}
      <Button size="lg" variant="secondary" onClick={toggleRailTab}>
        [F10] 오른쪽 탭
      </Button>
      {/* 🔴 키와 **같은 함수**를 쓴다. 몰입 레이어가 상단 바의 테마 버튼을 덮으므로 이 줄이 유일한 창구다 */}
      <Button size="lg" variant="secondary" onClick={switchTheme}>
        [Ctrl+Alt+D] {theme === 'dark' ? '라이트' : '다크'} 모드
      </Button>
      <span className="text-xs text-gray-700">
        담을 것 = ↑ ↓ · 숫자 4자리 이하 + Enter = 고른 줄 수량
      </span>

      {/*
       * 🔴 박스를 끝내는 두 버튼은 **하단 줄 오른쪽**이다(2026-09-17 사용자 지시) — 카드 안에
       *    있으면 목록 길이에 따라 위아래로 움직인다. `ml-auto` 가 오른쪽으로 민다.
       * 🔴 문구를 「발송 완료」로 바꾸지 말 것(2609_54/D9) — 이 시스템의 발송처리는 채널에
       *    송장을 올리는 일(2609_07)이고 포장 완료와 다른 일이다.
       * 🔴 박스를 잡고 있을 때만 그린다. 다른 상태에서는 누를 대상이 없다.
       */}
      {scanResult && isPending && (
        <div className="ml-auto flex items-center gap-3">
          <Button
            size="lg"
            variant="secondary"
            onClick={handleCancelBox}
            disabled={isSubmitting}
          >
            [Esc · F7] 취소
          </Button>
          <Button
            size="lg"
            variant="confirm"
            onClick={handleComplete}
            isLoading={isSubmitting}
            loadingText="완료 처리 중..."
            /* 🔴 판정은 `canComplete` 하나다 — `handleComplete` 의 검문과 같은 규칙이라
               버튼이 막는 경우와 눌렀을 때 거부되는 경우가 어긋나지 않는다.
               ⚠️ **키(`F6`·`Enter`)는 그대로다** — 조작 변경은 별개의 일이라(2609_55/D12)
               손대지 않았다. 키로 눌러도 `handleComplete` 가 같은 규칙으로 받는다. */
            disabled={!canComplete || isSubmitting}
            title={
              canComplete
                ? undefined
                : packedTotal === 0
                  ? '담은 물품이 없습니다 — 빈 박스는 [F4] 로 닫으세요'
                  : '발송 상품 목록 내 물품을 모두 포장해야 합니다.'
            }
          >
            [Enter · F6] 이 박스 완료
          </Button>
        </div>
      )}
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
        title="송장 미사용 처리"
        message="이 송장을 쓰지 않은 것으로 닫습니다. 출고·상자 기억을 남기지 않으며 되돌릴 수 없습니다. ⚠️ 택배사의 송장이 취소되는 것은 아닙니다 — 실물 라벨은 폐기하세요."
        confirmText="미사용으로 닫기"
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
   * 🔴 **뷰포트를 꽉 채운다** — 폭 제한 없음(`max-w-*` 금지), 높이는 세로 flex 로 나눠 갖는다.
   * 제목 줄 · 상단 줄(송장 정보 + 메시지 창) · 하단 F키 줄은 제 높이만 쓰고, 남는 높이는 3열 그리드가
   * 전부 먹는다. 넘치는 내용은 **카드 안에서** 스크롤한다 — 페이지 전체가 밀리면 자리가 흔들린다.
   * 1280px 미만은 비대상이라 예전처럼 세로로 쌓이고 레이어가 스크롤된다(`xl:` 접두사).
   */
  return (
    <div className="fixed inset-0 z-50 flex flex-col overflow-y-auto bg-page p-4 md:p-6 xl:overflow-hidden">
      <div className="flex w-full flex-col space-y-4 xl:min-h-0 xl:flex-1">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900">포장 작업</h1>
          <span className="text-sm text-gray-700">[Esc] 나가기 · [F8] 단축키</span>
        </div>
        {/* 🔴 상단 줄은 카드 2개다 — 왼쪽 송장 정보 · 오른쪽 메시지 창. 폭은 **반반**이다
            (2026-09-16 사용자 지시). 아래 3열과 세로선은 맞지 않는다 — 메시지를 읽을 폭이 먼저다 */}
        <div className="grid gap-4 xl:grid-cols-2">
          {scanCard}
          {messagePanel}
        </div>
        {/* 🔴 자리를 정하는 곳은 여기 하나다 — 이 문자열이 화면에 두 번 나오면 통일이 깨진 것이다 */}
        <div className="grid gap-4 xl:min-h-0 xl:flex-1 xl:grid-cols-[26rem_1fr_20rem]">
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
