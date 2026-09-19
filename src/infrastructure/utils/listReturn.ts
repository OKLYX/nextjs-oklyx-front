import type { ReadonlyURLSearchParams } from 'next/navigation';

/**
 * 목록 → 상세 → 목록 왕복에서 **목록의 조회 조건(page/검색어)을 잃지 않게** 하는 공용 헬퍼.
 *
 * **용도**: 상세 URL 에 `?from=<목록 쿼리스트링>` 을 실어 보내고, 상세의 [← 목록] 버튼이 그 값으로
 * 목록 URL 을 복원한다.
 * **파일**: src/infrastructure/utils/listReturn.ts
 *
 * **사용 예제**:
 * // 목록: 행 클릭
 * router.push(detailHrefWithReturn(ROUTES.PRODUCT_DETAIL(id), searchParams.toString()))
 * // 상세: 뒤로가기 버튼
 * router.push(listReturnHref(ROUTES.PRODUCTS_RETRIEVE, searchParams))
 *
 * ⚠️ `router.back()` 을 쓰지 않는 이유: 상세 화면이 자기 URL 을 한 번이라도 push 하면(예: 상품 상세의
 * 수정 모드 토글) 뒤로가기 한 번이 목록까지 닿지 않는다. 새 탭으로 상세 URL 을 직접 연 경우에도
 * 돌아갈 곳이 없다. `from` 은 새로고침·딥링크에도 살아남는다.
 *
 * ⚠️ `from` 이 없으면(직접 진입·생성 직후 리다이렉트) 조용히 목록 기본 상태로 돌아간다 — 에러가 아니다.
 *
 * ❌ 금지: 상세 화면이 목록 조회 조건을 sessionStorage/전역 store 에 따로 보관하는 것
 *    (조회 조건의 단일 진실원은 URL 이다).
 */

export const LIST_RETURN_KEY = 'from';

/** 상세 링크에 돌아올 목록의 조회 조건을 덧붙인다. 조건이 비어 있으면 그대로 둔다. */
export function detailHrefWithReturn(detailHref: string, listQuery: string): string {
  if (!listQuery) return detailHref;
  const separator = detailHref.includes('?') ? '&' : '?';
  return `${detailHref}${separator}${LIST_RETURN_KEY}=${encodeURIComponent(listQuery)}`;
}

/** 상세 URL 에 실려 온 조회 조건을 붙인 목록 URL. 실려 오지 않았으면 목록 기본 URL. */
export function listReturnHref(
  listRoute: string,
  sp: URLSearchParams | ReadonlyURLSearchParams,
): string {
  const from = sp.get(LIST_RETURN_KEY);
  if (!from) return listRoute;
  // 우리 앱이 실어 보낸 값이지만 한 번 더 직렬화해 형식을 정규화한다.
  const query = new URLSearchParams(from).toString();
  return query ? `${listRoute}?${query}` : listRoute;
}
