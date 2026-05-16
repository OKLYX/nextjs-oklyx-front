'use client';

interface PackageSearchCardProps {
  searchPackage: string;
  onSearchChange: (value: string) => void;
  onSearch: () => void;
  isLoading: boolean;
  resultCount: number;
  onAddClick: () => void;
}

export function PackageSearchCard({
  searchPackage,
  onSearchChange,
  onSearch,
  isLoading,
  resultCount,
  onAddClick,
}: PackageSearchCardProps) {
  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 mb-4">
        <div className="flex flex-col sm:flex-row gap-2 flex-1">
          <input
            type="text"
            placeholder="패키지 타입 검색..."
            value={searchPackage}
            onChange={(e) => onSearchChange(e.target.value)}
            disabled={isLoading}
            aria-label="패키지 타입으로 검색"
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
          />
          <button
            onClick={onSearch}
            disabled={isLoading}
            aria-label={isLoading ? '검색 진행 중' : '상자비 검색 버튼'}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 font-medium transition-colors whitespace-nowrap"
          >
            {isLoading ? '검색중...' : '검색'}
          </button>
        </div>
        <button
          onClick={onAddClick}
          disabled={isLoading}
          aria-label="새로운 상자비 추가"
          className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400 font-medium whitespace-nowrap transition-colors"
        >
          상자비 추가
        </button>
      </div>
      <p className="text-sm text-gray-600" role="status" aria-live="polite">
        검색 결과: {resultCount}건
      </p>
    </div>
  );
}
