'use client';

interface CrossChannelToggleProps {
  crossChannel: boolean;
  disabled: boolean;
  onChange: (crossChannel: boolean) => void;
}

/**
 * 채널 교차 토글 (FEATURE_2609_30 / 04 Step 4).
 *
 * - 합쳐 보기(`true`) = 마스터 상품 1행 — "이 상품이 전체적으로 돈이 되나"
 * - 채널별로 보기(`false`) = 마스터 × 채널 행 — "쿠팡은 남는데 네이버는 안 남는다"
 *
 * ⚠️ 서버 파라미터(`crossChannel`)라 값이 바뀌면 재조회다. 클라이언트에서 행을 접었다 펴는 것이 아니다.
 */
export function CrossChannelToggle({ crossChannel, disabled, onChange }: CrossChannelToggleProps) {
  const options: { value: boolean; label: string }[] = [
    { value: true, label: '채널 합쳐 보기' },
    { value: false, label: '채널별로 보기' },
  ];

  return (
    <div className="flex flex-col gap-1">
      <span className="text-sm font-medium text-gray-700">보기 방식</span>
      <div className="flex items-center gap-2">
        {options.map((option) => (
          <button
            key={String(option.value)}
            type="button"
            disabled={disabled}
            onClick={() => onChange(option.value)}
            className={`px-3 py-2 text-sm rounded-lg border disabled:opacity-50 ${
              crossChannel === option.value
                ? 'bg-blue-600 text-white border-blue-600'
                : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-100'
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}
