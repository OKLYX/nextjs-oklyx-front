import type { ReadonlyURLSearchParams } from 'next/navigation';
import type { MasterProductListParams } from '@/domain/entities/MasterProductEntity';

/**
 * 판매상품 마스터 목록의 조회 조건(page/size/sort/q) 파싱·직렬화 단일 소스 (110/111).
 *
 * **용도**: URL 쿼리스트링 ↔ 조회 조건 객체 ↔ API 파라미터 변환.
 * **파일**: src/app/dashboard/master-products/masterListQuery.ts
 *
 * **확장 지점**:
 * - 정렬/페이지 크기 옵션 추가 = 아래 배열에 1줄 (select 는 배열을 map 해서 그린다)
 * - 필터 추가 = `MasterListQuery` 필드 + parseQuery/toSearchParams/toApiParams 각 1줄 + 툴바 컨트롤 1개
 *
 * ⚠️ URL 키는 `q`, API 파라미터는 `search` 다(서버는 `search` 고정). 변환은 `toApiParams` 한 곳에서만
 * 하고, repository/usecase 안에서 이름을 바꾸지 말 것(레이어마다 어휘가 갈린다).
 *
 * ❌ 금지: select 옵션·페이지 크기를 JSX 에 하드코딩
 */

export const PAGE_SIZES = [25, 50, 100] as const;

export const SORT_OPTIONS = [
  { value: 'createdAt,desc', label: '등록일 최신순' },
  { value: 'createdAt,asc', label: '등록일 오래된순' },
] as const;

export const DEFAULT_PAGE = 0;
export const DEFAULT_SIZE = 25;
export const DEFAULT_SORT = SORT_OPTIONS[0].value;

export interface MasterListQuery {
  page: number;
  size: number;
  sort: string;
  q?: string;
}

/**
 * 잘못된 URL 로도 화면이 깨지지 않게 정규화한다(서버 400 을 사용자가 보게 두지 않는다).
 * page: 정수 아님/음수 → 0 · size: PAGE_SIZES 밖 → 25 · sort: SORT_OPTIONS 밖 → 기본값 · q: trim, 빈 문자열이면 없음
 */
export function parseQuery(sp: URLSearchParams | ReadonlyURLSearchParams): MasterListQuery {
  const rawPage = Number(sp.get('page'));
  const page = Number.isInteger(rawPage) && rawPage >= 0 ? rawPage : DEFAULT_PAGE;

  const rawSize = Number(sp.get('size'));
  const size = (PAGE_SIZES as readonly number[]).includes(rawSize) ? rawSize : DEFAULT_SIZE;

  const rawSort = sp.get('sort') ?? '';
  const sort = SORT_OPTIONS.some((o) => o.value === rawSort) ? rawSort : DEFAULT_SORT;

  const q = (sp.get('q') ?? '').trim();

  return q ? { page, size, sort, q } : { page, size, sort };
}

/** 기본값·빈 값 키는 제거해 URL 을 깨끗하게 유지한다. */
export function toSearchParams(query: MasterListQuery): URLSearchParams {
  const params = new URLSearchParams();
  if (query.page !== DEFAULT_PAGE) params.set('page', String(query.page));
  if (query.size !== DEFAULT_SIZE) params.set('size', String(query.size));
  if (query.sort !== DEFAULT_SORT) params.set('sort', query.sort);
  const q = query.q?.trim();
  if (q) params.set('q', q);
  return params;
}

/** URL 어휘(q) → API 어휘(search). 이 변환은 여기 한 곳에서만 한다. */
export function toApiParams(query: MasterListQuery): MasterProductListParams {
  const search = query.q?.trim();
  return {
    page: query.page,
    size: query.size,
    sort: query.sort,
    search: search ? search : undefined,
  };
}
