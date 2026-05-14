'use client';

interface CarrierRateSearchCardProps {
  searchCarrier: string;
  onSearchChange: (value: string) => void;
  onSearch: () => void;
  isLoading: boolean;
  resultCount: number;
  onAddClick: () => void;
}

export function CarrierRateSearchCard({
  searchCarrier,
  onSearchChange,
  onSearch,
  isLoading,
  resultCount,
  onAddClick,
}: CarrierRateSearchCardProps) {
  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex items-center justify-between gap-4 mb-4">
        <div className="flex-1 flex gap-2">
          <input
            type="text"
            placeholder="배송사명 검색..."
            value={searchCarrier}
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
          onClick={onAddClick}
          disabled={isLoading}
          className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400 font-medium whitespace-nowrap"
        >
          택배비 추가
        </button>
      </div>
      <p className="text-sm text-gray-600">검색 결과: {resultCount}건</p>
    </div>
  );
}
