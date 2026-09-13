import { PRICE_OVERRIDE_MAX, type RepricingRow } from '@/domain/entities/RepricingEntity';

/**
 * 「새 판매가」 직접 입력의 계산 규칙(FEATURE_2609_42 / PLAN D2·D4·D9).
 * File: src/app/dashboard/listings/repricing/components/priceDraft.ts
 *
 * 🔴 입력값은 화면에만 있다. 저장은 행마다 [저장] 으로만 나간다(2609_43 D5) — 저장하지 않은 값은
 *    마켓에 나가지 않고, 나갈 수도 없다(D6).
 * 🔴 AUTO 가격을 저장하면 `price_source` 는 AUTO 그대로여서 **다음 재계산 때 공식값으로 되돌아간다**(D2).
 *    직접 지정가(MANUAL) 행은 그대로 사람이 소유한 값으로 남는다(2609_43 D1·D2).
 * 🔴 마진 미리보기는 **화면이 계산한다**(D9). 확정 값은 저장 후 목록을 다시 불러온 값이다.
 */

/** 입력칸의 기본값 = 공식이 계산한 새 판매가. 계산 불가면 빈 칸. */
export const basePriceText = (row: RepricingRow) =>
  row.newPrice == null ? '' : String(Math.round(row.newPrice));

/**
 * 숫자·소수점 두 자리까지만 남긴다. 정수부 8자리 = 서버 `@Digits(integer = 8, fraction = 2)` 와 같은 한도다.
 * (음수 부호를 애초에 받지 않으므로 0 이하는 `0`·빈 칸 두 경우뿐이고, 그건 {@link parsePrice} 가 거른다.)
 */
export const sanitizePriceInput = (text: string) => {
  const cleaned = text.replace(/[^\d.]/g, '');
  const [head, ...rest] = cleaned.split('.');
  const intPart = head.slice(0, 8);
  if (rest.length === 0) return intPart;
  return `${intPart}.${rest.join('').slice(0, 2)}`;
};

/** 저장 가능한 금액이면 숫자, 아니면 null(빈 칸 · 0 이하 · 상한 초과). */
export const parsePrice = (text: string): number | null => {
  const trimmed = text.trim();
  if (trimmed === '') return null;
  const value = Number(trimmed);
  if (!Number.isFinite(value) || value <= 0 || value > PRICE_OVERRIDE_MAX) return null;
  return value;
};

/** 사용자가 손댔는지 = 입력칸 값이 공식값과 다른지. */
export const isEdited = (row: RepricingRow, draft: string | undefined) =>
  draft != null && draft !== basePriceText(row);

export interface MarginPreview {
  amount: number;
  rate: number;
}

/**
 * 입력가로 다시 센 마진 추정치.
 *
 * ```
 * 수수료율 = feeAmount / judgedPrice
 * 예상 마진액 = 입력가 − costSum − delivery − box − 입력가 × 수수료율
 * ```
 *
 * 🔴 필요한 값 중 하나라도 null 이면 **미리보기를 내지 않는다**(null 반환) — 0 으로 두면 마진을 거짓말한다.
 */
export const previewMargin = (row: RepricingRow, price: number): MarginPreview | null => {
  const { feeAmount, judgedPrice, costSum, delivery, box } = row;
  if (feeAmount == null || judgedPrice == null || costSum == null || delivery == null || box == null) {
    return null;
  }
  if (judgedPrice <= 0 || price <= 0) return null;
  const fee = price * (feeAmount / judgedPrice);
  const amount = price - costSum - delivery - box - fee;
  return { amount, rate: amount / price };
};
