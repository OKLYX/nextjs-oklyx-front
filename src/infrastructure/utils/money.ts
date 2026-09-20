/**
 * 금액 표시 단일 창구.
 *
 * **용도**: 화면에 금액을 찍을 때 쓰는 포맷터. 통화 기호·자릿수 규칙을 여기 한 곳에서 소유한다.
 * **파일**: src/infrastructure/utils/money.ts
 *
 * **필수 규칙**
 * - 금액 앞에 통화 기호를 직접 적지 않는다(`{`$`}{price}` 같은 코드가 실제로 상품 상세에
 *   달러로 남아 있었다 — 2026-09-20). 통화가 바뀌면 고칠 자리가 여기 하나여야 한다.
 * - 원화는 소수점을 쓰지 않는다 → `maximumFractionDigits: 0`.
 *
 * **사용 예제**
 * ```tsx
 * <td>{formatKrw(product.price)}</td>        // ₩12,000
 * <p>{formatKrw(null)}</p>                   // -
 * ```
 *
 * ⚠️ 통화는 아직 원화 고정이다. 다국가 통화가 필요해지면 인자로 통화를 받도록 이 파일만 넓힌다
 *    (호출부에 기호가 흩어져 있으면 그 작업이 불가능해진다).
 */

/** 표시 통화. 지금은 원화 하나뿐 — 바뀌면 이 상수와 아래 포맷터만 고친다. */
const CURRENCY = 'KRW';

const FORMATTER = new Intl.NumberFormat('ko-KR', {
  style: 'currency',
  currency: CURRENCY,
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

/** 금액 → `₩12,000`. 값이 없으면 `-` (표·상세에서 칸이 비어 보이지 않게). */
export function formatKrw(value: number | string | null | undefined): string {
  if (value === null || value === undefined || value === '') return '-';
  const amount = typeof value === 'number' ? value : Number(value);
  if (Number.isNaN(amount)) return '-';
  return FORMATTER.format(amount);
}
