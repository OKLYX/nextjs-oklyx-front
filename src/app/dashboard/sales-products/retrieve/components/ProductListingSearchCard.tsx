'use client';

interface ProductListingSearchCardProps {
  searchPlatform: string;
  onSearchChange: (value: string) => void;
  onSearch: () => void;
  isLoading: boolean;
  resultCount: number;
}

export function ProductListingSearchCard({
  searchPlatform,
  onSearchChange,
  onSearch,
  isLoading,
  resultCount,
}: ProductListingSearchCardProps) {

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h2 className="text-2xl font-semibold mb-6 text-gray-900">판매상품 조회</h2>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">플랫폼</label>
          <select
            value={searchPlatform}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
          >
            <option value="">선택하세요</option>
            <option value="COUPANG">쿠팡</option>
            <option value="GMARKET">지마켓</option>
            <option value="AUCTION">옥션</option>
            <option value="SMARTSTORE">스마트스토어</option>
          </select>
        </div>

        <div className="flex items-center justify-between">
          <div>
            {resultCount > 0 && (
              <p className="text-sm text-gray-600">{resultCount}개의 결과</p>
            )}
          </div>
          <button
            onClick={onSearch}
            disabled={isLoading}
            className="px-6 py-2 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors disabled:bg-blue-400 disabled:cursor-not-allowed"
          >
            {isLoading ? '검색 중...' : '검색'}
          </button>
        </div>
      </div>
    </div>
  );
}
