'use client';

import type { ReactNode } from 'react';
import { X } from 'lucide-react';
import { CLAIM_STATUS_LABEL, faultTypeText } from '@/domain/entities/ClaimEntity';
import type { Claim } from '@/domain/entities/ClaimEntity';

/**
 * 반품 상세. 목록 행 객체를 그대로 받는다 — 서버가 목록·상세에 같은 record 를 주므로
 * 단건 재조회가 없다.
 *
 * ⚠️ Stage A 는 조회 전용이다. 승인·입고확인 같은 처리 버튼을 여기에 붙이지 말 것.
 */
interface ClaimDetailsModalProps {
  claim: Claim | null;
  onClose: () => void;
}

// Platform display labels; unknown codes fall back to the raw code.
const PLATFORM_LABELS: Record<string, string> = { COUPANG: '쿠팡' };

function formatDate(value: string | null): string {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('ko-KR');
}

function Row({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex justify-between gap-4 py-2">
      <dt className="text-sm font-medium text-gray-500 shrink-0">{label}</dt>
      <dd className="text-sm text-gray-900 text-right break-all">{value}</dd>
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="mt-6 first:mt-0">
      <h4 className="text-lg font-semibold text-gray-900">{title}</h4>
      <dl className="mt-2 divide-y divide-gray-200">{children}</dl>
    </div>
  );
}

export function ClaimDetailsModal({ claim, onClose }: ClaimDetailsModalProps) {
  if (claim == null) return null;

  const collect =
    claim.collectInvoiceNo == null && claim.collectCarrierCode == null
      ? '-'
      : `${claim.collectCarrierCode ?? '-'} ${claim.collectInvoiceNo ?? '-'}`.trim();

  return (
    <div className="fixed inset-0 bg-black bg-opacity-25 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-lg w-full mx-4 max-w-3xl max-h-[85vh] flex flex-col p-8">
        <div className="shrink-0 flex items-center justify-between mb-6">
          <h3 className="text-2xl font-semibold text-gray-900">반품 상세</h3>
          <button
            onClick={onClose}
            aria-label="닫기"
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        {/* Only this middle band scrolls, so the close button stays reachable. */}
        <div className="flex-1 min-h-0 overflow-y-auto">
          <Section title="접수">
            <Row label="접수번호" value={claim.externalClaimId} />
            <Row label="접수일" value={formatDate(claim.receivedAt)} />
            <Row
              label="상태"
              value={
                <>
                  {CLAIM_STATUS_LABEL[claim.status]}
                  {claim.platformStatus && (
                    <span className="ml-2 text-xs text-gray-400">{claim.platformStatus}</span>
                  )}
                </>
              }
            />
            <Row label="플랫폼" value={PLATFORM_LABELS[claim.platform] ?? claim.platform} />
          </Section>

          <Section title="주문/상품">
            <Row label="주문번호" value={claim.externalOrderId} />
            <Row label="상품명" value={claim.itemName ?? '-'} />
            <Row label="수량" value={claim.quantity} />
            <Row label="판매자" value={claim.sellerName ?? '-'} />
            <Row label="고객명" value={claim.requesterName ?? '-'} />
          </Section>

          {!claim.linked && (
            <p className="mt-3 text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-4 py-2">
              이 반품에 해당하는 주문이 아직 동기화되지 않았습니다.
            </p>
          )}

          <Section title="처리">
            <Row label="사유" value={claim.reasonText ?? claim.reasonCode ?? '-'} />
            <Row label="귀책" value={faultTypeText(claim.faultType)} />
            <Row
              label="반품비"
              value={
                claim.returnShippingCharge != null
                  ? `${claim.returnShippingCharge.toLocaleString()}원`
                  : '-'
              }
            />
            <Row label="회수송장" value={collect} />
          </Section>
        </div>

        <div className="shrink-0 border-t border-gray-200">
          <div className="flex justify-end pt-6">
            <button
              onClick={onClose}
              className="px-6 py-3 bg-gray-300 text-gray-700 font-semibold text-base rounded-lg hover:bg-gray-400 transition-colors"
            >
              닫기
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
