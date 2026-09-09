'use client';

/**
 * 매출 화면 공통 기간 필터 (FEATURE_2609_30 / 04 Step 3).
 *
 * **순수 controlled**: `from`/`to` 는 부모(Container)가 소유하고 여기서 상태를 들지 않는다.
 * 두 탭(매출 현황 · 상품별 수익성)이 각자 자기 기간을 갖는다 — 전역 스토어로 올리지 않는다.
 *
 * ⚠️ 이 필터는 <b>판매일</b> 축이다. 판매자 표의 "받을 돈"(`pendingPayout`)은 매출인식일 축이라
 * 여기서 기간을 바꿔도 값이 변하지 않는다(PLAN 2609_30 D4). 그 사실은 표 헤더가 라벨로 설명한다.
 */

/** `yyyy-MM-dd` (로컬 기준). `toISOString()` 은 UTC 로 밀려 하루가 어긋난다. */
export function toDateInput(date: Date): string {
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

/** 기본 기간 = 이번 달 1일 ~ 오늘. */
export function currentMonthRange(): { from: string; to: string } {
  const today = new Date();
  return {
    from: toDateInput(new Date(today.getFullYear(), today.getMonth(), 1)),
    to: toDateInput(today),
  };
}

function lastMonthRange(): { from: string; to: string } {
  const today = new Date();
  return {
    from: toDateInput(new Date(today.getFullYear(), today.getMonth() - 1, 1)),
    to: toDateInput(new Date(today.getFullYear(), today.getMonth(), 0)),
  };
}

function recentDaysRange(days: number): { from: string; to: string } {
  const today = new Date();
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate() - (days - 1));
  return { from: toDateInput(start), to: toDateInput(today) };
}

const PRESETS: { label: string; range: () => { from: string; to: string } }[] = [
  { label: '이번 달', range: currentMonthRange },
  { label: '지난 달', range: lastMonthRange },
  { label: '최근 7일', range: () => recentDaysRange(7) },
];

interface PeriodFilterProps {
  from: string;
  to: string;
  isLoading: boolean;
  onChange: (from: string, to: string) => void;
  /** 오른쪽에 붙는 추가 컨트롤(판매자 select · 채널 교차 토글 등). */
  children?: React.ReactNode;
}

export function PeriodFilter({ from, to, isLoading, onChange, children }: PeriodFilterProps) {
  const isPresetActive = (preset: (typeof PRESETS)[number]) => {
    const range = preset.range();
    return range.from === from && range.to === to;
  };

  return (
    <div className="bg-white rounded-lg shadow px-6 py-4 flex flex-wrap items-end gap-3">
      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium text-gray-700">판매일 시작</label>
        <input
          type="date"
          value={from}
          max={to || undefined}
          disabled={isLoading}
          onChange={(e) => onChange(e.target.value, to)}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium text-gray-700">판매일 종료</label>
        <input
          type="date"
          value={to}
          min={from || undefined}
          disabled={isLoading}
          onChange={(e) => onChange(from, e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div className="flex items-center gap-2">
        {PRESETS.map((preset) => (
          <button
            key={preset.label}
            type="button"
            disabled={isLoading}
            onClick={() => {
              const range = preset.range();
              onChange(range.from, range.to);
            }}
            className={`px-3 py-2 text-sm rounded-lg border disabled:opacity-50 ${
              isPresetActive(preset)
                ? 'bg-blue-600 text-white border-blue-600'
                : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-100'
            }`}
          >
            {preset.label}
          </button>
        ))}
      </div>

      {children && <div className="ml-auto flex flex-wrap items-end gap-3">{children}</div>}
    </div>
  );
}
