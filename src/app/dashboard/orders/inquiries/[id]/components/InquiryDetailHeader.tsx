'use client';

import { INQUIRY_STATUS_LABEL } from '@/domain/entities/InquiryEntity';
import type { Inquiry, InquiryStatus } from '@/domain/entities/InquiryEntity';
import { channelOptionLabel } from '@/app/dashboard/orders/components/OrderSearchCard';

interface InquiryDetailHeaderProps {
  inquiry: Inquiry;
  /** 컨테이너가 `/types` 라벨 맵으로 판정해 넘긴 값 — 화면에 유형 상수표를 두지 않는다(D4). */
  typeLabel: string;
}

// 목록(InquiryTable)과 같은 색 규칙 — 미답변만 눈에 띄게.
const STATUS_BADGE: Record<InquiryStatus, string> = {
  UNANSWERED: 'bg-orange-100 text-orange-700',
  ANSWERED: 'bg-gray-100 text-gray-700',
  CLOSED: 'bg-gray-100 text-gray-700',
  STALE: 'bg-gray-100 text-gray-700',
};

// Same shape as InquiryTable.formatDate: null/parse failure must never paint a blank cell.
function formatDate(value: string | null): string {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('ko-KR');
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-2">
      <dt className="text-sm font-medium text-gray-500 shrink-0">{label}</dt>
      <dd className="text-sm text-gray-900 break-all">{value}</dd>
    </div>
  );
}

export function InquiryDetailHeader({ inquiry, typeLabel }: InquiryDetailHeaderProps) {
  return (
    <div className="bg-white rounded-lg shadow p-6 space-y-4">
      {/* 본문 첫 줄만 요약으로 — 전문은 좌측 스레드가 그린다. */}
      <h1 className="text-lg font-semibold text-gray-900 truncate" title={inquiry.content}>
        {inquiry.content}
      </h1>

      <div className="flex flex-wrap items-center gap-2">
        <span className="px-2 py-0.5 text-xs rounded-full bg-blue-100 text-blue-700">
          {typeLabel}
        </span>
        {/* platformStatus 는 디버깅용이라 배지 문구가 아니라 title 로만 붙인다. */}
        <span
          title={inquiry.platformStatus}
          className={`px-2 py-0.5 text-xs rounded-full ${STATUS_BADGE[inquiry.status]}`}
        >
          {INQUIRY_STATUS_LABEL[inquiry.status]}
        </span>
        <span className="px-2 py-0.5 text-xs rounded-full bg-gray-100 text-gray-700">
          {/* ⚠️ 별칭 미설정은 null 이 아니라 빈 문자열로 온다 — `??` 로 만들면 빈 배지가 된다. */}
          {channelOptionLabel(inquiry.marketplaceAccountId, inquiry.accountAlias)}
        </span>
        <span className="px-2 py-0.5 text-xs rounded-full bg-gray-100 text-gray-700">
          {inquiry.sellerName ?? '-'}
        </span>
      </div>

      <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2">
        <Meta label="문의일" value={formatDate(inquiry.inquiredAt)} />
        <Meta label="답변일" value={formatDate(inquiry.answeredAt)} />
        <Meta label="문의번호" value={inquiry.externalInquiryId} />
        {inquiry.category && <Meta label="문의유형" value={inquiry.category} />}
      </dl>
    </div>
  );
}
