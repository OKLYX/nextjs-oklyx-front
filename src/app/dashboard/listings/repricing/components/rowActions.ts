import type { RepricingGroup, RepricingRow } from '@/domain/entities/RepricingEntity';

/**
 * 행 단위 실행([개별 입력]·[마켓 반영])의 판정 규칙과 「방금 처리한 행」 기억(FEATURE_2609_43 / PLAN D4·D6·D7).
 * File: src/app/dashboard/listings/repricing/components/rowActions.ts
 *
 * 🔴 저장하지 않은 입력값이 있는 행은 **마켓 반영을 막는다**(D6) — 옛 값이 조용히 전송되는 것이 이 기능의
 *    출발점이 된 사고다. 판정은 {@link pushBlockOf} 한 곳에서만 한다.
 * 🔴 처리한 행은 기본 보기(「대응 필요만」)의 응답에서 빠진다 — 화면이 {@link RecentActionMap} 으로 기억해
 *    {@link mergeKeptRows} 로 그 자리에 그대로 남긴다(D7). 시간으로 지우지 않는다.
 */

/** optionId → 방금 무엇을 했고 그 결과 얼마가 됐는지. `price` 는 금액을 모를 때만 null */
export interface RecentAction {
  kind: 'SAVED' | 'PUSHED';
  price: number | null;
  at: number;
}

export type RecentActionMap = Record<number, RecentAction>;

/** 행 [마켓 반영]을 막는 사유. null = 누를 수 있다 */
export type PushBlockReason = 'UNSAVED' | 'NOTHING_TO_PUSH' | 'UNCALCULABLE';

/**
 * 행 [마켓 반영]의 활성 판정(D4·D6).
 *
 * - 편집 중(= 저장하지 않은 입력값이 있는 상태)이면 무조건 막는다 — 순서상 가장 먼저 본다
 * - 밀 것이 있다 = `pendingPush` 이거나 아직 한 번도 안 민 행(`marketPrice == null`)
 * - 🔴 직접 지정가(`MANUAL`)는 막지 않는다(D1) — 재계산에서만 빠진다(D2)
 */
export const pushBlockOf = (row: RepricingRow, isEditing: boolean): PushBlockReason | null => {
  if (row.excluded === 'UNCALCULABLE') return 'UNCALCULABLE';
  if (isEditing) return 'UNSAVED';
  if (!row.pendingPush && row.marketPrice != null) return 'NOTHING_TO_PUSH';
  return null;
};

/** 막힌 이유를 사람 말로. 계산 불가는 서버가 준 문장을 그대로 쓴다 */
export const pushBlockLabel = (row: RepricingRow, reason: PushBlockReason): string => {
  if (reason === 'UNSAVED') return '먼저 저장하세요';
  if (reason === 'NOTHING_TO_PUSH') return '마켓 가격과 같습니다';
  return row.excludedReason ?? '계산할 수 없습니다';
};

/**
 * 응답에서 빠진 행을 「마지막으로 알던 값 + 방금 한 일」로 되살린다(D7).
 * 저장이면 로컬 판매가만, 반영이면 마켓 가격까지 움직인 상태로 그린다.
 */
const keptRow = (row: RepricingRow, action: RecentAction): RepricingRow => {
  if (action.price == null) return row;
  const pushed = action.kind === 'PUSHED';
  return {
    ...row,
    sellingPrice: action.price,
    newPrice: action.price,
    marketPrice: pushed ? action.price : row.marketPrice,
    judgedPrice: pushed ? action.price : row.judgedPrice,
    pendingPush: pushed ? false : row.marketPrice != null && row.marketPrice !== action.price,
  };
};

/**
 * 새 응답과 직전 목록을 합친다.
 *
 * - 응답에 있는 행은 응답 값으로 갱신하되 **직전 순서를 유지**한다
 * - 응답에서 빠졌는데 방금 처리한 행이면 그 자리에 남긴다(D7)
 * - 그 외 새로 들어온 행은 뒤에 붙인다
 */
export const mergeKeptRows = (
  prevRows: RepricingRow[],
  freshRows: RepricingRow[],
  recent: RecentActionMap,
): RepricingRow[] => {
  const fresh = new Map(freshRows.map((r) => [r.optionId, r]));
  const merged: RepricingRow[] = [];
  const used = new Set<number>();

  for (const prev of prevRows) {
    const next = fresh.get(prev.optionId);
    if (next) {
      merged.push(next);
      used.add(prev.optionId);
      continue;
    }
    const action = recent[prev.optionId];
    if (action) {
      merged.push(keptRow(prev, action));
      used.add(prev.optionId);
    }
  }
  for (const row of freshRows) {
    if (!used.has(row.optionId)) merged.push(row);
  }
  return merged;
};

/** 남긴 행만 있는 묶음이 통째로 사라지지 않게 직전 집계를 덧붙인다(D7). 순서는 새 응답이 먼저다. */
export const mergeKeptGroups = (
  prevGroups: RepricingGroup[],
  freshGroups: RepricingGroup[],
  mergedRows: RepricingRow[],
): RepricingGroup[] => {
  const has = (g: RepricingGroup) =>
    freshGroups.some((f) => f.sellerId === g.sellerId && f.platform === g.platform);
  const kept = prevGroups.filter(
    (g) =>
      !has(g) && mergedRows.some((r) => r.sellerId === g.sellerId && r.platform === g.platform),
  );
  return [...freshGroups, ...kept];
};
