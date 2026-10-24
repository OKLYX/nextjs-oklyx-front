'use client';

import { Fragment } from 'react';
import type { PurchaseListItem } from '@/domain/entities/PurchaseListEntity';
import type { Seller } from '@/domain/entities/SellerEntity';
import { PurchaseGroupDetail } from './PurchaseGroupDetail';
import { ShareActionCell, type ShareActions } from './purchaseShareUi';
import { TableCard } from '@/presentation/components/ui/TableCard';
import { DataCard } from '@/presentation/components/DataCard';

// 완료 그룹이라도 추가 입고·정정이 있을 수 있어 토글 내용물은 구매목록 탭과 같다(PLAN 2609_29 D21).
interface CompletedPurchaseTableProps {
  items: PurchaseListItem[];
  sellers: Seller[];
  /** Seller filter; null = 「전체」. A chosen seller puts the share words and undo on the row (D83). */
  filterSellerId: number | null;
  stockLinked: boolean;
  productImages: Record<number, string | null>;
  isLoading: boolean;
  error: string;
  expandedProductId: number | null;
  onToggle: (productId: number) => void;
  onRecorded: () => void | Promise<void>;
  shareActions: ShareActions;
}

export function CompletedPurchaseTable({
  items,
  sellers,
  filterSellerId,
  stockLinked,
  productImages,
  isLoading,
  error,
  expandedProductId,
  onToggle,
  onRecorded,
  shareActions,
}: CompletedPurchaseTableProps) {
  // Narrow-screen cards (FEATURE_2610_31 D14 · D33): the app's purchase card — photo, bold name, 「브랜드」 · 「필요 수량」 ·
  // 「매입 완료 수량」 lines and the large 「매입 필요 수량」 at the bottom-right; the seller view's share words and undo at
  // the bottom. A tap opens the group detail right under the card, above the next card.
  const renderCards = () =>
    items.map((item) => {
      const isExpanded = expandedProductId === item.productId;
      const rowShare = filterSellerId != null ? item.shares[0] : undefined;
      return (
        <Fragment key={item.productId}>
          <DataCard
            onClick={() => onToggle(item.productId)}
            image={
              productImages[item.productId] ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={productImages[item.productId] as string}
                  alt={item.productName}
                  className="h-[104px] w-[104px] rounded border border-gray-200 bg-gray-50 object-cover"
                />
              ) : (
                <div className="flex h-[104px] w-[104px] items-center justify-center rounded border border-gray-200 bg-gray-50 text-xs text-gray-300">
                  없음
                </div>
              )
            }
            title={item.productName}
            trailing={<span className="text-gray-400">{isExpanded ? '▲' : '▼'}</span>}
            body={
              <div className="flex items-end justify-between gap-2">
                <div className="min-w-0 text-[13px] font-medium text-gray-500">
                  <p className="truncate">브랜드 : {item.brand?.trim() || '-'}</p>
                  <p className="truncate">필요 수량 : {item.neededQty}</p>
                  <p className="truncate">매입 완료 수량 : {item.purchasedQty}</p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-[11px] text-gray-500">매입 필요 수량</p>
                  <p
                    className={`text-2xl font-bold leading-tight ${
                      item.remainingQty > 0 ? 'text-amber-800' : 'text-green-700'
                    }`}
                  >
                    {item.remainingQty}
                  </p>
                </div>
              </div>
            }
            actions={
              rowShare ? (
                <ShareActionCell productId={item.productId} share={rowShare} actions={shareActions} />
              ) : undefined
            }
          />
          {isExpanded && (
            <div className="bg-gray-50 px-4 py-4">
              <PurchaseGroupDetail
                item={item}
                sellers={sellers}
                filterSellerId={filterSellerId}
                stockLinked={stockLinked}
                onRecorded={onRecorded}
                shareActions={shareActions}
              />
            </div>
          )}
        </Fragment>
      );
    });

  return (
    // 카드 머리말(제목·안내)이 로딩·빈 상태에서도 남아야 해 상태 행은 tbody 가 그대로 그린다.
    <TableCard renderCards={!isLoading && !error && items.length > 0 ? renderCards : undefined}>
      <div className="px-6 py-4 border-b border-gray-200">
        <h2 className="text-lg font-semibold text-gray-900">구매 완료 내역</h2>
        <p className="mt-1 text-xs text-gray-500">매입 완료 처리한 구성품입니다.</p>
      </div>

      <table className="w-full text-sm">
        <thead className="bg-gray-100 border-b border-gray-200">
          <tr className="text-gray-600">
            <th className="w-10 px-4 py-3"></th>
            <th className="px-4 py-3 text-left font-medium">구성품</th>
            <th className="px-4 py-3 text-left font-medium">브랜드</th>
            <th className="px-4 py-3 text-right font-medium">필요 수량</th>
            <th className="px-4 py-3 text-right font-medium">매입 완료 수량</th>
            <th className="px-4 py-3 text-right font-medium">매입 필요 수량</th>
            <th className="px-4 py-3 text-right font-medium">처리</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {isLoading && (
            <tr>
              <td colSpan={7} className="px-4 py-10 text-center text-gray-400">
                불러오는 중...
              </td>
            </tr>
          )}

          {!isLoading && error && (
            <tr>
              <td colSpan={7} className="px-4 py-10 text-center text-red-600">
                {error}
              </td>
            </tr>
          )}

          {!isLoading && !error && items.length === 0 && (
            <tr>
              <td colSpan={7} className="px-4 py-10 text-center text-gray-400">
                완료된 구매 내역이 없습니다.
              </td>
            </tr>
          )}

          {!isLoading &&
            !error &&
            items.map((item) => {
              const isExpanded = expandedProductId === item.productId;
              const rowShare = filterSellerId != null ? item.shares[0] : undefined;
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
                    <td className="px-4 py-3 text-gray-700">{item.brand?.trim() || '-'}</td>
                    <td className="px-4 py-3 text-right text-gray-700">{item.neededQty}</td>
                    <td className="px-4 py-3 text-right text-gray-700">{item.purchasedQty}</td>
                    <td className="px-4 py-3 text-right font-semibold text-gray-500">
                      {item.remainingQty}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {rowShare && (
                        <ShareActionCell productId={item.productId} share={rowShare} actions={shareActions} />
                      )}
                    </td>
                  </tr>

                  {isExpanded && (
                    <tr className="bg-gray-50">
                      <td colSpan={7} className="px-4 py-4">
                        <PurchaseGroupDetail
                          item={item}
                          sellers={sellers}
                          filterSellerId={filterSellerId}
                          stockLinked={stockLinked}
                          onRecorded={onRecorded}
                          shareActions={shareActions}
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
