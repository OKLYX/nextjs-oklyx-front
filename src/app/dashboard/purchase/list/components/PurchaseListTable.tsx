'use client';

import { Fragment } from 'react';
import type { PurchaseListItem } from '@/domain/entities/PurchaseListEntity';
import type { Seller } from '@/domain/entities/SellerEntity';
import { PurchaseGroupDetail } from './PurchaseGroupDetail';
import { ShareActionCell, TargetMetTag, type ShareActions } from './purchaseShareUi';
import { TableCard } from '@/presentation/components/ui/TableCard';

/** 'list' = rows to buy · 'skipped' = the 「오늘 넘김」 group (FEATURE_2610_09 D67). */
export type PurchaseListTableVariant = 'list' | 'skipped';

const VARIANT_TEXT: Record<PurchaseListTableVariant, { title: string; hint: string; empty: string }> = {
  list: { title: '구매 목록', hint: '매입 완료 처리 전인 구성품입니다.', empty: '구매할 항목이 없습니다.' },
  skipped: {
    title: '오늘 넘김',
    hint: '내일 매입으로 넘긴 구성품입니다. 다음 날 구매목록에 다시 나타납니다.',
    empty: '오늘 넘긴 항목이 없습니다.',
  },
};

interface PurchaseListTableProps {
  variant: PurchaseListTableVariant;
  items: PurchaseListItem[];
  sellers: Seller[];
  /** Seller filter; null = 「전체」. A chosen seller puts the share buttons on the row (D83). */
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

export function PurchaseListTable({
  variant,
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
}: PurchaseListTableProps) {
  const text = VARIANT_TEXT[variant];
  return (
    // 카드 머리말(제목·안내)이 로딩·빈 상태에서도 남아야 해 상태 행은 tbody 가 그대로 그린다.
    <TableCard>
      <div className="px-6 py-4 border-b border-gray-200">
        <h2 className="text-lg font-semibold text-gray-900">{text.title}</h2>
        <p className="mt-1 text-xs text-gray-500">{text.hint}</p>
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
                {text.empty}
              </td>
            </tr>
          )}

          {!isLoading &&
            !error &&
            items.map((item) => {
              const isExpanded = expandedProductId === item.productId;
              // Seller view: the row is that seller's one share (D83 — buttons on the row).
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
                        {rowShare && <TargetMetTag share={rowShare} />}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-700">{item.brand?.trim() || '-'}</td>
                    <td className="px-4 py-3 text-right text-gray-700">{item.neededQty}</td>
                    <td className="px-4 py-3 text-right text-gray-700">{item.purchasedQty}</td>
                    <td className="px-4 py-3 text-right font-semibold text-blue-600">
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
