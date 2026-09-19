import type { ReadonlyURLSearchParams } from 'next/navigation';

/**
 * 상품 목록(상품조회)의 조회 조건(page/q) 파싱·직렬화 단일 소스.
 *
 * **용도**: URL 쿼리스트링 ↔ 조회 조건 객체 변환.
 * **파일**: src/app/dashboard/products/retrieve/productListQuery.ts
 *
 * ⚠️ 조회 조건의 단일 진실원은 **URL** 이다. 상세로 갔다 돌아오면 컨테이너가 다시 마운트되므로
 * `useState` 로 들고 있으면 항상 첫 페이지로 돌아간다(2026-09-19 수정한 실제 버그).
 *
 * ⚠️ URL 키는 `q`, API 파라미터는 `search` 다. 변환은 `toApiParams` 한 곳에서만 한다.
 */

export const PAGE_SIZE = 20;
export const DEFAULT_PAGE = 0;

export interface ProductListQuery {
  page: number;
  search: string;
}

/** 잘못된 URL 로도 화면이 깨지지 않게 정규화한다. page: 정수 아님/음수 → 0 · q: trim */
export function parseQuery(sp: URLSearchParams | ReadonlyURLSearchParams): ProductListQuery {
  const rawPage = Number(sp.get('page'));
  const page = Number.isInteger(rawPage) && rawPage >= 0 ? rawPage : DEFAULT_PAGE;
  return { page, search: (sp.get('q') ?? '').trim() };
}

/** 기본값·빈 값 키는 제거해 URL 을 깨끗하게 유지한다. */
export function toSearchParams(query: ProductListQuery): URLSearchParams {
  const params = new URLSearchParams();
  if (query.page !== DEFAULT_PAGE) params.set('page', String(query.page));
  if (query.search) params.set('q', query.search);
  return params;
}
