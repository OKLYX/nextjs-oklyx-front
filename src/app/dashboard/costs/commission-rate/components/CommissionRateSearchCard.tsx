'use client';

interface CommissionRateSearchCardProps {
  searchPlatform: string;
  onSearchChange: (value: string) => void;
  onSearch: () => void;
  isLoading: boolean;
  resultCount: number;
  hasSearched: boolean;
}

export function CommissionRateSearchCard({
  searchPlatform,
  onSearchChange,
  onSearch,
  isLoading,
  resultCount,
  hasSearched,
}: CommissionRateSearchCardProps) {
  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex items-center justify-between gap-4 mb-4">
        <div className="flex-1 flex gap-2">
          <input
            type="text"
            placeholder="플랫폼명을 입력하세요"
            value={searchPlatform}
            onChange={(e) => onSearchChange(e.target.value)}
            disabled={isLoading}
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
          />
          <button
            onClick={onSearch}
            disabled={isLoading}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 font-medium"
          >
            {isLoading ? '검색중...' : '검색'}
          </button>
        </div>
        <button
          disabled
          className="px-6 py-2 bg-gray-300 text-white rounded-lg font-medium whitespace-nowrap cursor-not-allowed"
        >
          수수료 추가
        </button>
      </div>
      <p className="text-sm text-gray-600">검색 결과: {hasSearched ? resultCount : 0}건</p>
    </div>
  );
}
