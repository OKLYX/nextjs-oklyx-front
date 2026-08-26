'use client';

import type { Category } from '@/domain/entities/CategoryEntity';
import type { CategoryMapping } from '@/domain/entities/CategoryMappingEntity';

/**
 * 표준 카테고리 목록 테이블: 표준명 · 몰별 매핑 배지 · 액션(이름수정/매핑/삭제).
 * 비-ADMIN 은 액션 컬럼 없이 읽기.
 */
interface CategoryTableProps {
  categories: Category[];
  mappingsByCat: Record<number, CategoryMapping[]>;
  isAdmin: boolean;
  isLoading: boolean;
  onRename: (c: Category) => void;
  onMap: (c: Category) => void;
  onDelete: (c: Category) => void;
}

// 배지로 표시할 플랫폼(현 매핑 대상). 미매핑이면 회색.
const BADGE_PLATFORMS: { platform: string; label: string }[] = [{ platform: 'COUPANG', label: '쿠팡' }];

export function CategoryTable({
  categories,
  mappingsByCat,
  isAdmin,
  isLoading,
  onRename,
  onMap,
  onDelete,
}: CategoryTableProps) {
  if (isLoading) {
    return (
      <div className="bg-white rounded-lg shadow p-8 text-center text-gray-500">로딩 중...</div>
    );
  }

  if (categories.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow p-8 text-center text-gray-500">
        표준 카테고리가 없습니다.
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow list-table-scroll">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 border-b border-gray-200">
          <tr>
            <th className="px-6 py-3 text-left font-medium text-gray-700">표준 카테고리명</th>
            <th className="px-6 py-3 text-left font-medium text-gray-700">몰별 매핑</th>
            {isAdmin && (
              <th className="px-6 py-3 text-right font-medium text-gray-700">액션</th>
            )}
          </tr>
        </thead>
        <tbody>
          {categories.map((cat) => {
            const mappings = mappingsByCat[cat.id] || [];
            return (
              <tr key={cat.id} className="border-b border-gray-200">
                <td className="px-6 py-3 text-gray-900">{cat.name}</td>
                <td className="px-6 py-3">
                  <div className="flex flex-wrap gap-1.5">
                    {BADGE_PLATFORMS.map(({ platform, label }) => {
                      const mapped = mappings.some((m) => m.platform === platform);
                      return (
                        <span
                          key={platform}
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${
                            mapped
                              ? 'bg-blue-50 text-blue-700 border border-blue-200'
                              : 'bg-gray-100 text-gray-400 border border-gray-200'
                          }`}
                        >
                          {label} {mapped ? '✓' : '미매핑'}
                        </span>
                      );
                    })}
                  </div>
                </td>
                {isAdmin && (
                  <td className="px-6 py-3">
                    <div className="flex justify-end gap-2 whitespace-nowrap">
                      <button
                        onClick={() => onRename(cat)}
                        className="px-3 py-1 text-xs border border-gray-300 rounded hover:bg-gray-50"
                      >
                        이름수정
                      </button>
                      <button
                        onClick={() => onMap(cat)}
                        className="px-3 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700"
                      >
                        매핑
                      </button>
                      <button
                        onClick={() => onDelete(cat)}
                        className="px-3 py-1 text-xs border border-red-300 text-red-600 rounded hover:bg-red-50"
                      >
                        삭제
                      </button>
                    </div>
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
