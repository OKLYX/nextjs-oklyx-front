'use client';

import { Fragment } from 'react';
import type { PurchaseListItem } from '@/domain/entities/PurchaseListEntity';
import type { Seller } from '@/domain/entities/SellerEntity';
import { PurchaseGroupDetail } from './PurchaseGroupDetail';
import { TableCard } from '@/presentation/components/ui/TableCard';

// 완료 그룹이라도 추가 입고·정정이 있을 수 있어 토글 내용물은 구매목록 탭과 같다(PLAN 2609_29 D21).
interface CompletedPurchaseTableProps {
  items: PurchaseListItem[];
  sellers: Seller[];
  productImages: Record<number, string | null>;
  isLoading: boolean;
  error: string;
  expandedProductId: number | null;
  onToggle: (productId: number) => void;
  onRecorded: () => void | Promise<void>;
}

export function CompletedPurchaseTable({
  items,
  sellers,
  productImages,
  isLoading,
  error,
  expandedProductId,
  onToggle,
  onRecorded,
}: CompletedPurchaseTableProps) {
  return (
    // 카드 머리말(제목·안내)이 로딩·빈 상태에서도 남아야 해 상태 행은 tbody 가 그대로 그린다.
    <TableCard>
      <div className="px-6 py-4 border-b border-gray-200">
        <h2 className="text-lg font-semibold text-gray-900">구매 완료 내역</h2>
        <p className="mt-1 text-xs text-gray-500">구매가 완료된(잔여 ≤ 0) 구성품만 표시됩니다.</p>
      </div>

      <table className="w-full text-sm">
        <thead className="bg-gray-100 border-b border-gray-200">
          <tr className="text-gray-600">
            <th className="w-10 px-4 py-3"></th>
            <th className="px-4 py-3 text-left font-medium">구성품</th>
            <th className="px-4 py-3 text-right font-medium">필요</th>
            <th className="px-4 py-3 text-right font-medium">구매</th>
            <th className="px-4 py-3 text-right font-medium">잔여</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {isLoading && (
            <tr>
              <td colSpan={5} className="px-4 py-10 text-center text-gray-400">
                불러오는 중...
              </td>
            </tr>
          )}

          {!isLoading && error && (
            <tr>
              <td colSpan={5} className="px-4 py-10 text-center text-red-600">
                {error}
              </td>
            </tr>
          )}

          {!isLoading && !error && items.length === 0 && (
            <tr>
              <td colSpan={5} className="px-4 py-10 text-center text-gray-400">
                완료된 구매 내역이 없습니다.
              </td>
            </tr>
          )}

          {!isLoading &&
            !error &&
            items.map((item) => {
              const isExpanded = expandedProductId === item.productId;
              return (
                <Fragment key={item.productId}>
                  <tr
                    onClick={() => onToggle(item.productId)}
                    className="cursor-pointer hover:bg-gray-50"
                  >
                    <td className="px-4 py-3 text-center text-gray-400">
                      {isExpanded ? '▲' : '▼'}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        {productImages[item.productId] ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={productImages[item.productId] as string}
                            alt={item.productName}
                            className="w-10 h-10 rounded border border-gray-200 object-cover bg-gray-50"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded border border-gray-200 bg-gray-50 flex items-center justify-center text-gray-300 text-xs">
                            없음
                          </div>
                        )}
                        <span className="text-gray-900">{item.productName}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right text-gray-700">{item.neededQty}</td>
                    <td className="px-4 py-3 text-right text-gray-700">{item.purchasedQty}</td>
                    <td className="px-4 py-3 text-right font-semibold text-gray-500">
                      {item.remainingQty}
                    </td>
                  </tr>

                  {isExpanded && (
                    <tr className="bg-gray-50">
                      <td colSpan={5} className="px-4 py-4">
                        <PurchaseGroupDetail
                          item={item}
                          sellers={sellers}
                          onRecorded={onRecorded}
                        />
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
        </tbody>
      </table>
    </TableCard>
  );
}
