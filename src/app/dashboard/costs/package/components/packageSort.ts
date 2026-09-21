import type { Package } from '@/domain/entities/PackageEntity';

/**
 * 상자비 목록 정렬 축 (PLAN 2609_56 D2).
 *
 * **확장 지점**: 정렬을 더하려면 이 배열에 1줄 + `comparePackages` 에 `case` 1개.
 * ❌ `<option>` 을 JSX 에 하드코딩하지 말 것 — 드롭다운은 이 배열을 map 해서 그린다.
 *
 * 🔴 `created,*` 는 **`id` 로 정렬한다**(PLAN/D3). `package` 테이블에는 등록일 컬럼이 없고
 * (`Package` 는 `BaseEntity` 를 상속하지 않는다), `id` 는 auto-increment 라 등록 순서와 같다.
 * 나중에 `created_date` 가 생겨도 기존 행은 NULL 이라 이 정렬은 `id` 그대로 둔다.
 */
export const PACKAGE_SORT_OPTIONS = [
  { value: 'created,asc', label: '등록일 오래된순' },
  { value: 'created,desc', label: '등록일 최신순' },
  { value: 'name,asc', label: '상자 이름 가나다순' },
  { value: 'name,desc', label: '상자 이름 가나다 역순' },
  { value: 'cost,desc', label: '가격 높은순' },
  { value: 'cost,asc', label: '가격 낮은순' },
] as const;

export type PackageSort = (typeof PACKAGE_SORT_OPTIONS)[number]['value'];

/** 기본값 = `id` 오름차순 = 지금 서버가 주는 순서. 기본 화면의 순서를 바꾸지 않는다(PLAN/D4) */
export const DEFAULT_PACKAGE_SORT: PackageSort = 'created,asc';

/**
 * 🔴 같은 값이 있을 때는 `id` 로 2차 정렬한다 — 안 그러면 이름·가격이 같은 상자들의 순서가
 * 정렬을 다시 할 때마다 흔들린다.
 */
export function comparePackages(a: Package, b: Package, sort: PackageSort): number {
  const byId = a.id - b.id;

  switch (sort) {
    case 'created,asc':  return byId;
    case 'created,desc': return -byId;
    case 'name,asc':     return (a.type ?? '').localeCompare(b.type ?? '', 'ko') || byId;
    case 'name,desc':    return (b.type ?? '').localeCompare(a.type ?? '', 'ko') || byId;
    case 'cost,asc':     return (a.cost ?? 0) - (b.cost ?? 0) || byId;
    case 'cost,desc':    return (b.cost ?? 0) - (a.cost ?? 0) || byId;
  }
}
