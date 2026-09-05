'use client';

import type { ReactNode } from 'react';
import { X } from 'lucide-react';
import {
  CLAIM_STATUS_LABEL,
  CLAIM_TYPE_LABEL,
  collectStatusText,
  faultTypeText,
} from '@/domain/entities/ClaimEntity';
import type { Claim } from '@/domain/entities/ClaimEntity';
import { ClaimActionPanel } from './ClaimActionPanel';

/**
 * 반품/교환 상세. 목록 행 객체를 그대로 받는다 — 서버가 목록·상세에 같은 record 를 준다.
 *
 * 종류 분기는 `claim.claimType` 하나로 한다: 반품은 `처리` 1섹션, 교환은 `회수`·`재발송` 2섹션.
 *
 * 처리 액션(승인·입고확인·송장등록)은 본문 맨 아래 `ClaimActionPanel` 이 담당한다
 * (FEATURE_2609_21). 무엇을 그릴지는 서버의 `claim.availableActions` 가 정하므로 이 모달은
 * 액션을 알지 못한다 — 버튼을 여기에 직접 붙이지 말 것.
 *
 * ⚠️ 액션이 성공하면 그 claim 만 다시 읽어(D8) `onActionDone` 으로 올라간다. 부모가 그 객체로
 * `selectedClaim` 을 교체해야 열려 있는 이 모달이 갱신된다.
 */
interface ClaimDetailsModalProps {
  claim: Claim | null;
  onClose: () => void;
  /** 단건 재조회 결과 — 컨테이너 핸들러를 그대로 패널에 내려보낸다. */
  onActionDone: (updated: Claim) => void;
}

// Platform display labels; unknown codes fall back to the raw code.
const PLATFORM_LABELS: Record<string, string> = { COUPANG: '쿠팡' };

function formatDate(value: string | null): string {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('ko-KR');
}

// Shared by 회수 and 재발송 — both rows read `-` when neither carrier nor invoice is set.
const invoiceText = (carrier: string | null, invoice: string | null): string =>
  carrier == null && invoice == null ? '-' : `${carrier ?? '-'} ${invoice ?? '-'}`.trim();

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

export function ClaimDetailsModal({ claim, onClose, onActionDone }: ClaimDetailsModalProps) {
  if (claim == null) return null;

  const isExchange = claim.claimType === 'EXCHANGE';
  const typeLabel = CLAIM_TYPE_LABEL[claim.claimType];
  const collect = invoiceText(claim.collectCarrierCode, claim.collectInvoiceNo);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-25 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-lg w-full mx-4 max-w-3xl max-h-[85vh] flex flex-col p-8">
        <div className="shrink-0 flex items-center justify-between mb-6">
          <h3 className="text-2xl font-semibold text-gray-900">{typeLabel} 상세</h3>
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
              이 {typeLabel}에 해당하는 주문이 아직 동기화되지 않았습니다.
            </p>
          )}

          {isExchange ? (
            <>
              <Section title="회수">
                <Row label="사유" value={claim.reasonText ?? claim.reasonCode ?? '-'} />
                <Row label="귀책" value={faultTypeText(claim.faultType)} />
                {/* 회수상태는 교환에만 있다(05). 이 한 줄이 있어야 "왜 재발송 버튼이 없나"가 화면에서
                    설명된다 — 반품 상세에는 그리지 않는다(항상 null 이라 `-` 만 늘어난다). */}
                <Row label="회수상태" value={collectStatusText(claim.collectStatus)} />
                <Row label="회수송장" value={collect} />
              </Section>
              {/* Rendered even while empty: "not reshipped yet" and "no reshipment concept"
                  are different facts. 반품비 is dropped instead — it is always null for 교환. */}
              <Section title="재발송">
                <Row
                  label="재발송송장"
                  value={invoiceText(claim.reshipCarrierCode, claim.reshipInvoiceNo)}
                />
              </Section>
            </>
          ) : (
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
          )}

          {/* 스크롤 본문의 맨 마지막 — 푸터(shrink-0)에 넣으면 폼을 펼칠 때 푸터가 커지며
              본문 스크롤 영역을 잡아먹는다. 상세를 다 읽고 나서 누르는 순서라 위치도 자연스럽다. */}
          <ClaimActionPanel claim={claim} onActionDone={onActionDone} />
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
