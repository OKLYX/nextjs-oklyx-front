'use client';

import type { OptionCheckSuffixConfig } from '@/domain/entities/OptionCheckSuffix';

/**
 * 등록상품명 "옵션확인" 접미사 레벨 편집 컨트롤 (판매자 / 채널 / 마스터 3곳 공용).
 *
 * **용도**: 옵션이 2개 이상일 때 등록상품명 끝에 붙는 ` - {문구}` 접미사를 이 레벨에서 지정한다.
 * 해석 순서 = `채널 override ?? 마스터 override ?? 판매자 기본 ?? 시스템(OFF)`(백엔드 69). 아무 데도
 * 지정 안 하면 접미사 미부착(2026-08-27 결정 = 시스템 기본값 없음).
 *
 * **파일**: src/presentation/components/OptionCheckSuffixControl.tsx
 *
 * **입력 규칙(체크박스 없음)**: 문구 입력칸 하나만 있다.
 * - 문구를 쓰면 그 레벨에 적용 → `{enabled:true, suffix:문구}`.
 * - 비우면 상속(상위 레벨) → `{enabled:null, suffix:null}`. 전부 비면 접미사 미부착.
 * (별도 ON/OFF 토글·override 게이트 없음 — 값이 있으면 적용, 없으면 nullable.)
 *
 * **controlled 규칙**: 순수 controlled — 부모가 `value` 를 소유하고 `onChange` 로만 갱신.
 * 내부 state·set-state-in-effect 금지(프로젝트 lint 규칙).
 *
 * **사용 예제**:
 * ```tsx
 * const [cfg, setCfg] = useState<OptionCheckSuffixConfig>({ optionCheckSuffixEnabled: null, optionCheckSuffix: null });
 * <OptionCheckSuffixControl
 *   value={cfg}
 *   onChange={setCfg}
 *   inheritedHint="입력하지 않으면 추가 문구가 붙지 않습니다."
 *   disabled={isSaving}
 * />
 * ```
 *
 * @param value 이 레벨의 현재 값(suffix null/blank = 상속).
 * @param onChange 값 변경 콜백(부모 state 갱신).
 * @param inheritedHint 비어(상속) 있을 때 보여줄 실제 적용값 안내(옵션).
 * @param disabled 저장 중 등 비활성화 여부.
 */
interface OptionCheckSuffixControlProps {
  value: OptionCheckSuffixConfig;
  onChange: (next: OptionCheckSuffixConfig) => void;
  inheritedHint?: string;
  disabled?: boolean;
}

export function OptionCheckSuffixControl({
  value,
  onChange,
  inheritedHint,
  disabled = false,
}: OptionCheckSuffixControlProps) {
  const suffix = value.optionCheckSuffix ?? '';

  const handleChange = (next: string) => {
    if (next.trim() === '') {
      // 비움 = 상속(override 해제).
      onChange({ optionCheckSuffixEnabled: null, optionCheckSuffix: null });
    } else {
      onChange({ optionCheckSuffixEnabled: true, optionCheckSuffix: next });
    }
  };

  return (
    <div className="space-y-1">
      <input
        type="text"
        value={suffix}
        disabled={disabled}
        maxLength={50}
        placeholder="예: 옵션확인"
        onChange={(e) => handleChange(e.target.value)}
        className="w-full px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
      />
      {suffix.trim() === '' ? (
        <p className="text-xs text-gray-500">
          {inheritedHint ?? '비워두면 추가 문구가 붙지 않습니다.'}
        </p>
      ) : (
        <p className="text-xs text-gray-500">
          옵션 2개 이상 등록상품명에 <span className="font-medium">{` - ${suffix}`}</span> 접미사가 붙습니다.
        </p>
      )}
    </div>
  );
}
