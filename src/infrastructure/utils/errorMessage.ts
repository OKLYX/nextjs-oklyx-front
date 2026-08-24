/**
 * axios 에러/일반 에러에서 사용자 표시용 메시지를 추출한다.
 *
 * 우선순위: 백엔드 표준 봉투 `response.data.message` > `Error.message` > fallback.
 * 인라인 배너/토스트에서 재사용(각 컴포넌트가 개별 파싱하지 않도록).
 */
export function extractErrorMessage(e: unknown, fallback: string): string {
  if (typeof e === 'object' && e !== null) {
    const res = (e as { response?: { data?: { message?: unknown } } }).response;
    const msg = res?.data?.message;
    if (typeof msg === 'string' && msg.trim()) return msg;
  }
  if (e instanceof Error && e.message) return e.message;
  return fallback;
}
