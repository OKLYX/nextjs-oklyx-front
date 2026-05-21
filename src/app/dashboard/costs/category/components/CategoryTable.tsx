'use client';

import type { Category } from '@/domain/entities/CategoryEntity';

interface CategoryTableProps {
  categories: Category[];
  isLoading: boolean;
  selectedId?: number;
  onRowClick?: (category: Category) => void;
}

export function CategoryTable({
  categories,
  isLoading,
  selectedId,
  onRowClick,
}: CategoryTableProps) {
  if (isLoading) {
    return (
      <div className="bg-white rounded-lg shadow p-8 text-center text-gray-500">
        로딩 중...
      </div>
    );
  }

  if (categories.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow p-8 text-center text-gray-500">
        검색 결과가 없습니다.
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 border-b border-gray-200">
          <tr>
            <th className="px-6 py-3 text-left font-medium text-gray-700">ID</th>
            <th className="px-6 py-3 text-left font-medium text-gray-700">카테고리명</th>
            <th className="px-6 py-3 text-left font-medium text-gray-700">플랫폼</th>
            <th className="px-6 py-3 text-left font-medium text-gray-700">플랫폼 카테고리 ID</th>
          </tr>
        </thead>
        <tbody>
          {categories.map((cat) => (
            <tr
              key={cat.id}
              onClick={() => onRowClick?.(cat)}
              className={`border-b border-gray-200 cursor-pointer hover:bg-gray-100 transition-colors ${
                selectedId === cat.id ? 'bg-blue-50' : ''
              }`}
            >
              <td className="px-6 py-3 text-gray-900">{cat.id}</td>
              <td className="px-6 py-3 text-gray-900">{cat.name}</td>
              <td className="px-6 py-3 text-gray-600">{cat.platform}</td>
              <td className="px-6 py-3 text-gray-600">{cat.platformCategoryId}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
