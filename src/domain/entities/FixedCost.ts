/**
 * 채널 월 고정비 (FEATURE_2609_33 / PLAN 2609_33 D1 · D2 · D2-1 · D3 · D5, 백엔드 01 SSOT).
 *
 * 🔴 금액·임계의 소유자는 <b>플랫폼 카탈로그</b>다. 채널은 항목을 연결만 하고 금액을 복사해 갖지 않는다(D1)
 * — 카탈로그 한 줄을 고치면 그 항목을 쓰는 모든 채널에 그대로 반영된다.
 *
 * 🔴 그 달에 실제로 부과되는지는 <b>서버가 달마다</b> 판정한다(D2). 화면이 매출을 보고 부과 여부를
 * 계산하지 않는다 — 판정 축(할인 후 매출·주문일)이 서버와 어긋나는 순간 두 화면이 다른 답을 낸다.
 */

/** 플랫폼 단위 고정비 항목 (카탈로그 한 줄). `GET /api/admin/fixed-costs` */
export interface PlatformFixedCost {
  id: number;
  platform: string;
  name: string;
  /** 월 정액, **VAT 포함 값 그대로**(D3). 🔴 채널이 이 값을 복사해 갖지 않는다(D1). */
  amount: number;
  /** 이 금액 이상 팔린 달에만 부과된다(쿠팡 기준 1,000,000 · 가전/디지털 5,000,000). */
  thresholdAmount: number;
  active: boolean;
}

/** 부과 모드 (D2). `AUTO` = 서버가 달마다 매출로 판정 · `ALWAYS` = 매출 무관 · `NEVER` = 부과 안 함. */
export type FixedCostChargeMode = 'AUTO' | 'ALWAYS' | 'NEVER';

/**
 * 채널 연결 (D2·D2-1·D5). `appliedFrom`·`appliedTo` 는 `YYYY-MM`, null = 전 기간·진행 중.
 *
 * ⚠️ `fixedCostId` 는 카탈로그 항목 id 다(연결 행 id 가 아니다) — replace(PUT)가 이 id 로 오간다.
 */
export interface AccountFixedCost {
  fixedCostId: number;
  name: string;
  amount: number;
  chargeMode: FixedCostChargeMode;
  /** 실효 임계(override 가 있으면 그 값). 표시 전용 — 저장은 `thresholdOverride` 로 한다. */
  thresholdAmount: number;
  thresholdOverride: number | null;
  appliedFrom: string | null;
  appliedTo: string | null;
}

/** PUT 바디의 한 항목 (응답 타입과 다르다 — 실효 임계·이름은 서버가 정한다). */
export interface AccountFixedCostRequestItem {
  fixedCostId: number;
  chargeMode: FixedCostChargeMode;
  thresholdOverride?: number | null;
  appliedFrom?: string | null;
  appliedTo?: string | null;
}

/** 카탈로그 항목 생성 바디. */
export interface CreateFixedCostRequest {
  platform: string;
  name: string;
  amount: number;
  thresholdAmount: number;
}

/** 카탈로그 항목 부분 수정 바디 — 보내지 않은 필드는 서버가 기존 값을 유지한다. */
export interface UpdateFixedCostRequest {
  name?: string;
  amount?: number;
  thresholdAmount?: number;
  active?: boolean;
}

/**
 * 부과 모드 사용자 문구 (UI 용어 규칙 — 화면에 enum 원문을 쓰지 않는다).
 * 모르는 값은 원문 그대로 두어 새 모드가 붙어도 화면이 빈칸이 되지 않게 한다.
 */
const CHARGE_MODE_LABELS: Record<string, string> = {
  AUTO: '매출 기준 자동',
  ALWAYS: '항상 부과',
  NEVER: '부과 안 함',
};

export const chargeModeLabel = (mode: string | null | undefined): string =>
  mode == null || mode === '' ? '—' : (CHARGE_MODE_LABELS[mode] ?? mode);

/** 부과 모드 `<select>` 옵션 (순서 = 화면 표시 순서, 기본값이 맨 위). */
export const CHARGE_MODE_OPTIONS: { value: FixedCostChargeMode; label: string }[] = [
  { value: 'AUTO', label: CHARGE_MODE_LABELS.AUTO },
  { value: 'ALWAYS', label: CHARGE_MODE_LABELS.ALWAYS },
  { value: 'NEVER', label: CHARGE_MODE_LABELS.NEVER },
];

/** 쿠팡 일반 카테고리 임계(D2-1). 카탈로그 추가 폼의 프리필 값이다. */
export const DEFAULT_THRESHOLD_AMOUNT = 1000000;

/** 금액 표시(원 단위 정수). 고정비는 정액이라 소수 원이 없다. */
export const formatFixedCostAmount = (value: number | null | undefined): string =>
  value == null ? '—' : Math.round(value).toLocaleString('ko-KR');

/** 적용 기간 문구. 둘 다 비어 있으면 null(표시하지 않는다). */
export const appliedPeriodLabel = (
  from: string | null | undefined,
  to: string | null | undefined
): string | null => {
  if (!from && !to) return null;
  return `적용 ${from ?? '~'} ~ ${to ?? '진행 중'}`;
};
