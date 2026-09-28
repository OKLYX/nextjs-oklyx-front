/**
 * KST 벽시계 문자열 도우미 (FEATURE_2609_75 / D4).
 *
 * **용도**: 서버가 주는 예약 시각('yyyy-MM-ddTHH:mm:ss', 한국시간 벽시계)을 화면·입력칸 형식으로 바꾸고 되돌린다.
 * **파일**: src/infrastructure/utils/kstWallClock.ts
 * 🔴 `new Date()` 로 바꾸지 않는다 — 브라우저 시간대가 끼어 UTC·해외 환경에서 9시간 어긋난다. 문자열만 자른다.
 *
 * @example formatKstWallClock('2026-09-29T00:02:00') // '2026-09-29 00:02'
 * @example toDateTimeLocal('2026-09-29T00:02:00')    // '2026-09-29T00:02' (<input type="datetime-local"> 값)
 * @example fromDateTimeLocal('2026-09-29T00:02')     // '2026-09-29T00:02:00' (서버 전송 값)
 */
export function formatKstWallClock(value: string): string {
  return value.replace('T', ' ').slice(0, 16);
}

export function toDateTimeLocal(value: string): string {
  return value.slice(0, 16);
}

export function fromDateTimeLocal(value: string): string {
  return value.length === 16 ? `${value}:00` : value;
}
