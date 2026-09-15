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

/**
 * 마켓이 준 KST 벽시계 시각(주문일·접수일·문의일) → `3시간 전`. 값이 없으면 `없음`.
 *
 * 🔴 위 `formatRelativeTime` 과 **다른 함수다.** 그쪽은 서버가 낙인한 naive UTC(`마지막 동기화`)라
 * `Z` 를 붙이고, 이 값들은 이미 KST 라 붙이면 9시간 어긋난다(브라우저 로컬 = KST 전제).
 * 알림 목록(`AlertFeedItem.occurredAt`)이 쓰는 함수가 이쪽이다(FEATURE_2609_51 / PLAN D8).
 *
 * ❌ 둘을 하나로 합치지 말 것 — 같은 "상대 시각"이지만 기준 시간대가 다르다.
 */
export const formatMarketRelativeTime = (value: string | null): string => {
  if (!value) return '없음';
  // `Z` 를 붙이지 않는다 — 오프셋 없는 문자열은 JS 가 로컬(KST)로 파싱하고, 그게 맞는 해석이다.
  const target = new Date(value).getTime();
  if (Number.isNaN(target)) return '없음';
  const minutes = Math.floor((Date.now() - target) / 60000);
  if (minutes < 1) return '방금 전';
  if (minutes < 60) return `${minutes}분 전`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}시간 전`;
  return `${Math.floor(hours / 24)}일 전`;
};
