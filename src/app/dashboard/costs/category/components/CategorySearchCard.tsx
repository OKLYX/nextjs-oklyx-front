'use client';

interface CategorySearchCardProps {
  searchName: string;
  onSearchNameChange: (value: string) => void;
  onSearch: () => void;
  onAddClick: () => void;
  isLoading: boolean;
}

export function CategorySearchCard({
  searchName,
  onSearchNameChange,
  onSearch,
  onAddClick,
  isLoading,
}: CategorySearchCardProps) {
  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex items-center justify-between gap-4">
        <div className="flex-1 flex gap-2">
          <input
            type="text"
            placeholder="검색할 카테고리명 입력"
            value={searchName}
            onChange={(e) => onSearchNameChange(e.target.value)}
            disabled={isLoading}
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
          />
          <button
            onClick={onSearch}
            disabled={isLoading}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 font-medium"
          >
            {isLoading ? '로딩중...' : '검색'}
          </button>
        </div>
        <button
          onClick={onAddClick}
          disabled={isLoading}
          className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400 font-medium whitespace-nowrap"
        >
          카테고리 추가
        </button>
      </div>
    </div>
  );
}
