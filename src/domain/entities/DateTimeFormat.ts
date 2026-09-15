/**
 * 서버 시각 표기 공용 함수 (FEATURE_2609_49).
 *
 * **용도**: 서버가 낙인한 시각(동기화·정산 등)을 화면에 상대 표기로 보여주는 단일 창구.
 * **필수 규칙**: 화면마다 `new Date(value)` 사본을 만들지 말고 이 함수를 쓴다.
 * **파일**: src/domain/entities/DateTimeFormat.ts
 */

/**
 * 서버의 ISO LocalDateTime(오프셋 없음) → `3시간 전`. 이력이 없으면 `없음`.
 *
 * 🔴 The server emits naive UTC wall-clock time (its container has no TZ set), but JS parses an
 * offset-less date-time string as LOCAL time. Appending `Z` pins it to UTC — without this the
 * banner reads "9시간 전" right after a successful sync.
 *
 * ⚠️ 값에 이미 `Z` 나 `+09:00` 이 붙어 오면 `Z` 를 덧붙이면 안 된다. 지금 서버는 항상 오프셋 없이
 * 내려주므로 분기를 두지 않는다 — 서버 포맷이 바뀌면 여기를 함께 고친다.
 */
export const formatRelativeTime = (value: string | null): string => {
  if (!value) return '없음';
  const target = new Date(`${value}Z`).getTime();
  if (Number.isNaN(target)) return '없음';
  const minutes = Math.floor((Date.now() - target) / 60000);
  if (minutes < 1) return '방금 전';
  if (minutes < 60) return `${minutes}분 전`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}시간 전`;
  return `${Math.floor(hours / 24)}일 전`;
};
