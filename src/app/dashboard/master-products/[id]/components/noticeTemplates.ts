// 상품정보제공고시(product-info notice) — 참조("상세페이지 참조") 헬퍼만 남긴다.
//
// 전환(prompt 62): 하드코딩 고시 템플릿·유형 select 폐기 → 카테고리별 고시 항목은 백엔드
// notices(CategoryNotice[])가 결정한다. 고시 유형/필드 정의는 더 이상 프론트에 없다.
// 값 맵은 Record<notice.key, value> 로 통일(별도 매핑 없음).

import type { CategoryNotice } from '@/domain/entities/MasterProductEntity';

// "전체 상품 상세페이지 참조" 일괄 채우기 값.
export const NOTICE_REF_TEXT = '상품 상세페이지 참조';

// 주어진 notices 의 모든 고시 필드값이 참조 텍스트인가(예약 플래그 키 없이 값 자체로 파생 →
// 저장/복원 라운드트립, 백엔드 payload 오염 없음). 빈 목록이면 false.
export function isNoticeRefAll(notices: CategoryNotice[], values: Record<string, string>): boolean {
  return notices.length > 0 && notices.every((n) => values[n.key] === NOTICE_REF_TEXT);
}

// notices 전체를 일괄 채우기(checked → REF_TEXT)/비우기(!checked → '')한 새 값 맵.
export function applyNoticeRefAll(
  notices: CategoryNotice[],
  values: Record<string, string>,
  checked: boolean,
): Record<string, string> {
  const next = { ...values };
  for (const n of notices) next[n.key] = checked ? NOTICE_REF_TEXT : '';
  return next;
}

// ─────────────────────────────────────────────────────────────────────────────
// 상품정보제공고시 = 품목군(groupName) 셀렉션 (사용자 하나 선택 → 그 그룹만 전송, 62 이전 UX 복원)
//
// 카테고리는 여러 품목군의 고시를 줄 수 있다. 예전(62 이전)엔 유형(품목군) select 로 하나를 골라
// 그 유형만 채워 전송했으나 62 에서 전부 펼쳐 렌더·전송으로 바뀌었다. 사용자 요구로 셀렉션을
// 되살리되 옵션은 하드코딩이 아니라 **백엔드 notices 의 groupName** 에서 뽑는다. 값 맵은 전체를
// state 에 보존하되 저장/검증은 선택된 그룹만 대상으로 한다.

// groupName 이 없으면(null) "기타" 로 정규화한다.
export const NOTICE_GROUP_ETC = '기타';
export const noticeGroupName = (n: CategoryNotice): string => n.groupName ?? NOTICE_GROUP_ETC;

// 표시 순서대로 중복 없는 품목군 목록(첫 등장 순서, "기타"는 항상 마지막).
export function noticeGroupsOf(notices: CategoryNotice[]): string[] {
  const seen: string[] = [];
  for (const n of notices) {
    const g = noticeGroupName(n);
    if (!seen.includes(g)) seen.push(g);
  }
  return seen.sort((a, b) => (a === NOTICE_GROUP_ETC ? 1 : b === NOTICE_GROUP_ETC ? -1 : 0));
}

// 실효 선택 그룹: 명시 선택(selected)이 아직 유효하면 그대로, 아니면 값이 입력된 그룹(저장된
// 마스터를 그 품목군으로 유지), 그마저 없으면 첫 그룹. 그룹이 없으면 ''.
export function resolveNoticeGroup(
  notices: CategoryNotice[],
  values: Record<string, string>,
  selected: string | null,
): string {
  const groups = noticeGroupsOf(notices);
  if (selected != null && groups.includes(selected)) return selected;
  const withValue = groups.find((g) =>
    notices.some((n) => noticeGroupName(n) === g && (values[n.key] ?? '').trim() !== ''),
  );
  return withValue ?? groups[0] ?? '';
}

// 선택된 그룹의 고시 key/값만 추린 맵(저장/전송 대상). 값에 없는 key 는 제외.
export function noticesForGroup(
  notices: CategoryNotice[],
  values: Record<string, string>,
  group: string,
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const n of notices) {
    if (noticeGroupName(n) === group && n.key in values) out[n.key] = values[n.key];
  }
  return out;
}
