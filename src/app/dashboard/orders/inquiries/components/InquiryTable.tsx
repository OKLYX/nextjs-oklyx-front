'use client';

import { useRouter } from 'next/navigation';
import { ROUTES } from '@/config/routes';
import { INQUIRY_STATUS_LABEL } from '@/domain/entities/InquiryEntity';
import type { Inquiry, InquiryStatus } from '@/domain/entities/InquiryEntity';
import { channelOptionLabel } from '@/app/dashboard/orders/components/OrderSearchCard';
import { Pagination } from '@/presentation/components/Pagination';
import { TableCard } from '@/presentation/components/ui/TableCard';

interface InquiryTableProps {
  inquiries: Inquiry[];
  /** `code → label` from GET /api/inquiries/types (D4) — the screen has no type table of its own. */
  typeLabelMap: Record<string, string>;
  isLoading: boolean;
  error: string;
  hasSearched: boolean;
  // Sorting is a single axis (문의일) — no sort key, only a direction.
  sortDir: 'asc' | 'desc';
  onToggleSort: () => void;
  onRetry: () => void;
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  /** The container decides the wording — "no data" and "filtered out" mean different things. */
  emptyMessage: string;
}

const HEADERS: { label: string; sortable?: boolean }[] = [
  { label: '문의일', sortable: true },
  { label: '채널' },
  { label: '유형' },
  { label: '상품' },
  { label: '문의 내용' },
  { label: '상태' },
  { label: '답변일' },
];

// 미답변만 눈에 띄게 — 나머지는 회색이라 목록을 훑을 때 처리할 건이 먼저 보인다.
const STATUS_BADGE: Record<InquiryStatus, string> = {
  UNANSWERED: 'bg-orange-100 text-orange-700',
  ANSWERED: 'bg-gray-100 text-gray-700',
  CLOSED: 'bg-gray-100 text-gray-700',
  STALE: 'bg-gray-100 text-gray-700',
};

// Same shape as ClaimTable.formatDate: null/parse failure must never paint a blank cell.
function formatDate(value: string | null): string {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('ko-KR');
}

export function InquiryTable({
  inquiries,
  typeLabelMap,
  isLoading,
  error,
  hasSearched,
  sortDir,
  onToggleSort,
  onRetry,
  currentPage,
  totalPages,
  onPageChange,
  emptyMessage,
}: InquiryTableProps) {
  const router = useRouter();

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700 flex items-center justify-between gap-4">
        <span>{error}</span>
        <button
          type="button"
          onClick={onRetry}
          className="px-3 py-1 text-sm font-medium border border-red-300 rounded hover:bg-red-100 transition-colors"
        >
          다시 시도
        </button>
      </div>
    );
  }

  return (
    <TableCard
      isLoading={isLoading}
      loadingMessage="조회 중..."
      isEmpty={!hasSearched || inquiries.length === 0}
      emptyMessage={hasSearched ? emptyMessage : '조회 조건을 선택하고 [조회]를 눌러 주세요.'}
    >
      <table className="w-full">
        <thead className="bg-gray-100 border-b border-gray-200">
          <tr>
            {HEADERS.map((col) => (
              <th
                key={col.label}
                onClick={col.sortable ? onToggleSort : undefined}
                className={`px-6 py-3 text-left text-sm font-semibold text-gray-900 ${
                  col.sortable
                    ? 'cursor-pointer select-none hover:bg-gray-200 transition-colors'
                    : ''
                }`}
              >
                {col.label}
                {col.sortable && <span className="ml-1">{sortDir === 'asc' ? '▲' : '▼'}</span>}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200">
          {inquiries.map((inquiry) => (
            <tr
              key={inquiry.id}
              // 상세는 모달이 아니라 페이지다(D16) — 좌우 2단에 답변 작성까지 들어가고,
              // 작성 중 바깥 클릭으로 닫히면 쓴 글이 날아간다.
              onClick={() => router.push(`${ROUTES.ORDERS_INQUIRIES}/${inquiry.id}`)}
              className="hover:bg-gray-50 transition-colors cursor-pointer"
            >
              <td className="px-6 py-3 text-sm text-gray-700 whitespace-nowrap">
                {formatDate(inquiry.inquiredAt)}
              </td>
              <td className="px-6 py-3 text-sm text-gray-700 whitespace-nowrap">
                {channelOptionLabel(inquiry.marketplaceAccountId, inquiry.accountAlias)}
              </td>
              <td className="px-6 py-3 text-sm text-gray-700 whitespace-nowrap">
                {/* 모르는 코드도 공백으로 두지 않는다 — 원문을 그대로 보여준다. */}
                {typeLabelMap[inquiry.inquiryType] ?? inquiry.inquiryType}
              </td>
              <td className="px-6 py-3 text-sm text-gray-700">
                {inquiry.itemName ?? '-'}
                {!inquiry.linked && (
                  <span className="ml-2 px-2 py-0.5 text-xs rounded-full bg-gray-100 text-gray-600 whitespace-nowrap">
                    주문 미연결
                  </span>
                )}
              </td>
              <td className="px-6 py-3 text-sm text-gray-700 max-w-xs truncate">
                {inquiry.content}
              </td>
              <td className="px-6 py-3 text-sm text-gray-700 whitespace-nowrap">
                <span
                  className={`px-2 py-0.5 text-xs rounded-full ${STATUS_BADGE[inquiry.status]}`}
                >
                  {INQUIRY_STATUS_LABEL[inquiry.status]}
                </span>
              </td>
              <td className="px-6 py-3 text-sm text-gray-700 whitespace-nowrap">
                {formatDate(inquiry.answeredAt)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {totalPages > 1 && (
        <div className="px-6 py-4 border-t border-gray-200">
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={onPageChange}
          />
        </div>
      )}
    </TableCard>
  );
}
