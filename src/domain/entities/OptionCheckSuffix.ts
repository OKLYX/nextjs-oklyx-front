// "옵션확인" 접미사 설정(FEATURE_2608_06 / 69·70) 공용 타입.
//
// 해석 순서(백엔드 69 담당) = 채널 override ?? 마스터 override ?? 판매자 기본 ?? 시스템(ON, "옵션확인").
// 프론트는 각 레벨의 값만 편집한다.
//
// null = 상속(상위 레벨로 폴백). 시스템 기본 = OFF(아무 데도 지정 안 하면 접미사 미부착, 2026-08-27 결정).

/** 응답에 실린 현재 레벨의 override 값. enabled/suffix 둘 다 nullable(null = 상속). */
export interface OptionCheckSuffixConfig {
  optionCheckSuffixEnabled: boolean | null;
  optionCheckSuffix: string | null;
}

/**
 * PUT .../registration-name-suffix 요청 바디.
 *
 * ⚠️ keep-existing PATCH 아님(replace): 한 필드만 보내면 다른 필드는 null(상속)로 덮인다.
 * 항상 두 값을 함께 채워 보낸다(enabled 만 바꿔도 suffix 재전송).
 */
export interface OptionCheckSuffixRequest {
  enabled: boolean | null;
  suffix: string | null;
}
