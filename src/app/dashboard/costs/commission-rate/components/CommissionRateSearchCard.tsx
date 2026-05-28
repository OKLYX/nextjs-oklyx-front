'use client';

interface CommissionRateSearchCardProps {
  selectedPlatform: string;
  onPlatformChange: (value: string) => void;
  searchCategory: string;
  onCategorySearchChange: (value: string) => void;
  platforms: string[];
  onSearch: () => void;
  isLoading: boolean;
  resultCount: number;
  hasSearched: boolean;
  onCreateClick: () => void;
}

export function CommissionRateSearchCard({
  selectedPlatform,
  onPlatformChange,
  searchCategory,
  onCategorySearchChange,
  platforms,
  onSearch,
  isLoading,
  resultCount,
  hasSearched,
  onCreateClick,
}: CommissionRateSearchCardProps) {
  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex items-center justify-between gap-4 mb-4">
        <div className="flex-1 flex gap-2">
          <select
            value={selectedPlatform}
            onChange={(e) => onPlatformChange(e.target.value)}
            disabled={isLoading}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
          >
            <option value="">플랫폼 선택</option>
            {platforms.map(platform => (
              <option key={platform} value={platform}>
                {platform}
              </option>
            ))}
          </select>
          <input
            type="text"
            placeholder="카테고리명을 입력하세요"
            value={searchCategory}
            onChange={(e) => onCategorySearchChange(e.target.value)}
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
          onClick={onCreateClick}
          disabled={isLoading}
          className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400 font-medium whitespace-nowrap"
        >
          수수료 추가
        </button>
      </div>
      <p className="text-sm text-gray-600">검색 결과: {hasSearched ? resultCount : 0}건</p>
    </div>
  );
}
