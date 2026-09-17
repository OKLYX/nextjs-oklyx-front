'use client';

import type { Package } from '@/domain/entities/PackageEntity';
import { BOX_KIND_LABEL, boxKindOf } from '@/domain/entities/PackageEntity';
import { TableCard } from '@/presentation/components/ui/TableCard';
import { BoxShape, boxScale, maxBoxExtentCm } from '@/presentation/components/BoxShape';
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

/**
 * 상자 그림 칸의 한 변(px). 목록에서 가장 큰 상자가 이 크기로 그려진다.
 * 가장 작은 상자는 BoxShape 의 하한(40%)까지 줄어드니, 그 상태에서도 모양이 보이도록 잡는다.
 */
const BOX_CELL_PX = 88;

export function PackageTable({
  packages,
  isLoading,
  error,
  hasSearched,
  selectedId,
  onRowClick,
}: PackageTableProps) {
  // 목록 안에서 대소가 보이도록 가장 큰 상자를 기준으로 삼는다
  const referenceCm = maxBoxExtentCm(packages);

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
              <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">상자</th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">패키지 타입</th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">유형</th>
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
                {/* 사진이 있으면 사진, 없으면 치수 비율 도형(PLAN 2609_40 D26).
                    사진도 같은 배율로 줄여 그린다 — 사진 유무로 크기 잣대가 달라지면 안 된다 */}
                <td className="px-6 py-3">
                  <div
                    className="flex items-end justify-center"
                    style={{ height: BOX_CELL_PX, width: BOX_CELL_PX }}
                  >
                    {pkg.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={pkg.imageUrl}
                        alt={`${pkg.type} 상자 사진`}
                        className="rounded border border-gray-200 object-contain"
                        style={{
                          height: BOX_CELL_PX * boxScale(pkg, referenceCm),
                          width: BOX_CELL_PX * boxScale(pkg, referenceCm),
                        }}
                      />
                    ) : (
                      <BoxShape
                        widthCm={pkg.widthCm}
                        lengthCm={pkg.lengthCm}
                        heightCm={pkg.heightCm}
                        size={BOX_CELL_PX}
                        referenceCm={referenceCm}
                      />
                    )}
                  </div>
                </td>
                <td className="px-6 py-3 text-sm text-gray-900">{pkg.type || '-'}</td>
                <td className="px-6 py-3 text-sm">
                  {boxKindOf(pkg) === 'RECYCLED' ? (
                    <span className="inline-block px-3 py-1 bg-gray-100 text-gray-600 rounded-full text-xs font-medium whitespace-nowrap">
                      {BOX_KIND_LABEL.RECYCLED}
                    </span>
                  ) : (
                    <span className="text-sm text-gray-900 whitespace-nowrap">
                      {BOX_KIND_LABEL.PURCHASED}
                    </span>
                  )}
                </td>
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
