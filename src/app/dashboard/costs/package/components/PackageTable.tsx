'use client';

import type { Package } from '@/domain/entities/PackageEntity';
import { TableCard } from '@/presentation/components/ui/TableCard';
import { formatPackageSize, sizeIsUnset } from './packageSize';

interface PackageTableProps {
  packages: Package[];
  isLoading: boolean;
  error: string;
  hasSearched: boolean;
  selectedId?: number;
  onRowClick?: (pkg: Package) => void;
}

function formatDate(date: string | null | undefined): string {
  return date ? date : '없음';
}

function formatCost(cost: number | null | undefined): string {
  return cost !== null && cost !== undefined ? cost.toLocaleString() + '원' : '0원';
}

export function PackageTable({
  packages,
  isLoading,
  error,
  hasSearched,
  selectedId,
  onRowClick,
}: PackageTableProps) {
  const errorBanner = error ? (
    <div
      role="alert"
      className="mb-4 bg-red-50 border border-red-200 rounded-lg p-4 text-red-800"
    >
      {error}
    </div>
  ) : null;

  return (
    <>
      {errorBanner}
      <TableCard
        isLoading={isLoading && hasSearched}
        isEmpty={packages.length === 0}
        emptyMessage={
          hasSearched ? '조회 결과가 없습니다.' : '검색 버튼을 클릭하여 상자비 정보를 조회해주세요.'
        }
      >
        <table className="w-full" role="grid" aria-label="상자비 목록">
          <thead className="bg-gray-100 border-b border-gray-200">
            <tr>
              <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">패키지 타입</th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">사이즈</th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">비용</th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">유효일</th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">기본값</th>
            </tr>
          </thead>
          <tbody>
            {packages.map((pkg) => (
              <tr
                key={pkg.id}
                onClick={() => onRowClick?.(pkg)}
                role="row"
                tabIndex={0}
                onKeyPress={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onRowClick?.(pkg);
                  }
                }}
                className={`border-b cursor-pointer hover:bg-gray-100 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  selectedId === pkg.id ? 'bg-blue-50' : ''
                }`}
              >
                <td className="px-6 py-3 text-sm text-gray-900">{pkg.type || '-'}</td>
                <td
                  className={`px-6 py-3 text-sm ${sizeIsUnset(pkg) ? 'text-gray-400' : 'text-gray-900'}`}
                >
                  {formatPackageSize(pkg)}
                </td>
                <td className="px-6 py-3 text-sm text-gray-900">{formatCost(pkg.cost)}</td>
                <td className="px-6 py-3 text-sm text-gray-900">{formatDate(pkg.effectiveDate)}</td>
                <td className="px-6 py-3 text-sm">
                  {pkg.isDefault ? (
                    <span className="inline-block px-3 py-1 bg-green-100 text-green-800 rounded-full text-xs font-medium">
                      기본값
                    </span>
                  ) : (
                    <span className="text-gray-400">-</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </TableCard>
    </>
  );
}
