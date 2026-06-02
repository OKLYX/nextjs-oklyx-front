'use client';

interface SellerSearchCardProps {
  searchName: string;
  onSearchChange: (value: string) => void;
  onSearch: () => void;
  isLoading: boolean;
  resultCount: number;
}

export function SellerSearchCard({
  searchName,
  onSearchChange,
  onSearch,
  isLoading,
  resultCount,
}: SellerSearchCardProps) {
  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h2 className="text-2xl font-semibold mb-6 text-gray-900">판매자 검색</h2>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">판매자명</label>
          <input
            type="text"
            placeholder="판매자명 검색"
            value={searchName}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
          />
        </div>

        <div className="flex items-center justify-between">
          <div>
            {resultCount > 0 && (
              <p className="text-sm text-gray-600">검색 결과 {resultCount}개</p>
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
