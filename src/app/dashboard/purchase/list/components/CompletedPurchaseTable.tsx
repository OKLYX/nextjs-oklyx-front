'use client';

import { Fragment } from 'react';
import type { PurchaseListItem, PurchaseListLine } from '@/domain/entities/PurchaseListEntity';

interface CompletedPurchaseTableProps {
  items: PurchaseListItem[];
  productImages: Record<number, string | null>;
  isLoading: boolean;
  error: string;
  expandedProductId: number | null;
  onToggle: (productId: number) => void;
}

// Read-only line summary + purchase history. No record/adjust forms (history is immutable here).
function CompletedLineRow({ line }: { line: PurchaseListLine }) {
  const isManual = line.source === 'MANUAL';
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span
          className={`px-2 py-0.5 rounded text-xs font-medium ${
            isManual ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'
          }`}
        >
          {isManual ? '수동' : '주문'}
        </span>
        {line.externalOrderId && (
          <span className="text-gray-500">주문번호 {line.externalOrderId}</span>
        )}
        <span className="ml-auto text-gray-600">
          필요 <b className="text-gray-900">{line.autoQty + line.manualQty}</b>
          {' · '}구매 <b className="text-gray-900">{line.purchasedQty}</b>
        </span>
      </div>

      <div className="mt-3">
        {line.records.length === 0 ? (
          <p className="text-xs text-gray-400">구매 이력 없음</p>
        ) : (
          <ul className="space-y-1">
            {line.records.map((record) => (
              <li key={record.id} className="text-xs text-gray-600 flex gap-3">
                <span>{record.purchasedOn}</span>
                <span className={record.quantity < 0 ? 'text-red-600' : 'text-gray-800'}>
                  {record.quantity > 0 ? `+${record.quantity}` : record.quantity}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

export function CompletedPurchaseTable({
  items,
  productImages,
  isLoading,
  error,
  expandedProductId,
  onToggle,
}: CompletedPurchaseTableProps) {
  return (
    <div className="bg-white rounded-lg shadow overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-200">
        <h2 className="text-lg font-semibold text-gray-900">구매 완료 내역</h2>
        <p className="mt-1 text-xs text-gray-500">구매가 완료된(잔여 ≤ 0) 구성품만 표시됩니다.</p>
      </div>

      <table className="w-full text-sm">
        <thead className="bg-gray-50 text-gray-600">
          <tr>
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
                        <div className="space-y-3">
                          {item.lines.map((line) => (
                            <CompletedLineRow key={line.itemId} line={line} />
                          ))}
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
        </tbody>
      </table>
    </div>
  );
}
