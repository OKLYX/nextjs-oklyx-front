/**
 * 상세 이미지 그룹 = 테넌트 공용 이미지 존 카탈로그 (FEATURE_2609_03, backend 01).
 * File: src/domain/entities/DetailImageGroupEntity.ts
 *
 * 상세 템플릿의 `imageZone` 블록은 자유입력이 아니라 이 카탈로그의 항목을 고른다.
 * ⚠️ `code` 는 불변 식별자이자 매핑 키(= 블록 `bind`, = master_image_zone_assignment.zone_id).
 *    화면에는 절대 노출하지 않는다 — 사용자에게 보이는 값은 `name` 뿐이다(이름을 바꿔도 매핑은 유지).
 */
export interface DetailImageGroup {
  id: number;
  /** 불변 식별자 = 블록의 bind 값 = 매핑 키. 화면에 노출 금지. */
  code: string;
  /** 표시명 (사용자가 보는 유일한 값). */
  name: string;
  sortOrder: number;
  /** 이 그룹을 쓰는 활성 템플릿 수. 0 이 아니면 삭제 불가. */
  templateCount: number;
  /** 이 그룹에 매핑된 마스터 사진 수. ⚠️ 삭제 차단 조건이 아니다(확인 문구 전용). */
  imageCount: number;
  /** 사용 중인 활성 템플릿 이름 (최대 5개). */
  usedByTemplateNames: string[];
}
