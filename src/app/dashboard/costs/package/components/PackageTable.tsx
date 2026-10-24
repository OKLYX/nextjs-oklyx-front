'use client';

import type { Package } from '@/domain/entities/PackageEntity';
import { BOX_KIND_LABEL, boxKindOf } from '@/domain/entities/PackageEntity';
import { TableCard } from '@/presentation/components/ui/TableCard';
import { DataCard } from '@/presentation/components/DataCard';
import { BoxShape, boxScale, maxBoxExtentCm } from '@/presentation/components/BoxShape';
import { formatPackageSize, sizeIsUnset } from './packageSize';

interface PackageTableProps {
  /** 이 페이지에 그릴 줄 */
  packages: Package[];
  /**
   * 배율 기준이 되는 목록(= 페이지를 자르기 전 걸러진 전체).
   * 🔴 **필수다.** 선택 prop 으로 두고 `?? packages` 로 흘리면 안 넘겨도 컴파일이 통과해
   * 화면에서만 조용히 틀린다 — 같은 상자가 페이지마다 다른 크기로 그려진다.
   */
  referenceScopePackages: Package[];
  /** 검색어·유형 칩이 걸려 있는가 (빈 상태 문구가 갈린다) */
  hasFilter: boolean;
  isLoading: boolean;
  error: string;
  selectedId?: number;
  onRowClick?: (pkg: Package) => void;
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
  referenceScopePackages,
  hasFilter,
  isLoading,
  error,
  selectedId,
  onRowClick,
}: PackageTableProps) {
  // 목록 안에서 대소가 보이도록 가장 큰 상자를 기준으로 삼는다.
  // 🔴 기준은 자른 페이지가 아니라 걸러진 전체 — 페이지마다 잣대가 달라지면 안 된다
  const referenceCm = maxBoxExtentCm(referenceScopePackages);

  const errorBanner = error ? (
    <div
      role="alert"
      className="mb-4 bg-red-50 border border-red-200 rounded-lg p-4 text-red-800"
    >
      {error}
    </div>
  ) : null;

  // The photo when there is one, otherwise a shape in the box's proportions (PLAN 2609_40 D26). The photo is scaled
  // by the same ratio — the scale must not change with whether there is a photo. Shared by the table and the cards.
  const boxPicture = (pkg: Package) => (
    <div className="flex items-end justify-center" style={{ height: BOX_CELL_PX, width: BOX_CELL_PX }}>
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
  );

  const boxKind = (pkg: Package) =>
    boxKindOf(pkg) === 'RECYCLED' ? (
      <span className="inline-block px-3 py-1 bg-gray-100 text-gray-600 rounded-full text-xs font-medium whitespace-nowrap">
        {BOX_KIND_LABEL.RECYCLED}
      </span>
    ) : (
      <span className="text-sm text-gray-900 whitespace-nowrap">{BOX_KIND_LABEL.PURCHASED}</span>
    );

  // Narrow-screen cards (FEATURE_2610_31 D14 · D37): the app's box card — type, 「기본값」 badge at the right end, cost
  // and size lines; the table's box picture and kind at the bottom.
  const renderCards = () =>
    packages.map((pkg) => (
      <DataCard
        key={pkg.id}
        onClick={() => onRowClick?.(pkg)}
        selected={selectedId === pkg.id}
        title={pkg.type || '-'}
        trailing={
          pkg.isDefault ? (
            <span className="rounded bg-green-100 px-2 py-1 text-xs text-green-700">기본값</span>
          ) : undefined
        }
        body={
          <div className="space-y-1 text-sm text-gray-900">
            <p>비용: {formatCost(pkg.cost)}</p>
            <p className={sizeIsUnset(pkg) ? 'text-gray-500' : undefined}>사이즈: {formatPackageSize(pkg)}</p>
          </div>
        }
        extraFields={[
          { label: '상자', value: boxPicture(pkg) },
          { label: '유형', value: boxKind(pkg) },
        ]}
      />
    ));

  return (
    <>
      {errorBanner}
      <TableCard
        renderCards={renderCards}
        isLoading={isLoading}
        isEmpty={packages.length === 0}
        emptyMessage={hasFilter ? '조회 결과가 없습니다.' : '등록된 상자가 없습니다.'}
      >
        <table className="w-full" role="grid" aria-label="상자비 목록">
          <thead className="bg-gray-100 border-b border-gray-200">
            <tr>
              <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">상자</th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">패키지 타입</th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">유형</th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">사이즈</th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">비용</th>
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
                <td className="px-6 py-3">{boxPicture(pkg)}</td>
                <td className="px-6 py-3 text-sm text-gray-900">{pkg.type || '-'}</td>
                <td className="px-6 py-3 text-sm">{boxKind(pkg)}</td>
                <td
                  className={`px-6 py-3 text-sm ${sizeIsUnset(pkg) ? 'text-gray-400' : 'text-gray-900'}`}
                >
                  {formatPackageSize(pkg)}
                </td>
                <td className="px-6 py-3 text-sm text-gray-900">{formatCost(pkg.cost)}</td>
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
