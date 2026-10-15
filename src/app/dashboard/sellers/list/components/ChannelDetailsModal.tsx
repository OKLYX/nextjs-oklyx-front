'use client';

import { useEffect, useState } from 'react';
import type { MarketplaceAccount, TemplateOption } from '@/domain/entities/MarketplaceAccountEntity';
import type { AccountFixedCost } from '@/domain/entities/FixedCost';
import {
  appliedPeriodLabel,
  chargeModeLabel,
  formatFixedCostAmount,
} from '@/domain/entities/FixedCost';
import {
  AS_NOTICE_KEY,
  NOTICE_TEXT_FIELDS,
  RETURN_EXCHANGE_NOTICE_KEY,
} from '@/domain/entities/ElevenstNoticeText';
import type { FixedCostUseCase } from '@/application/usecases/FixedCostUseCase';
import type { ShippingUseCase } from '@/application/usecases/ShippingUseCase';
import { Button } from '@/presentation/components/ui/Button';
import { Modal } from '@/presentation/components/ui/Modal';
import { ChannelTabBar, type ChannelTabKey } from './ChannelModalTabs';
import {
  ChannelShippingSummary,
  loadChannelShipping,
  type ChannelShippingData,
} from './ChannelShippingSummary';

// Mirror of ChannelRegistrationForm's PLATFORM_OPTIONS for display labels.
const PLATFORM_LABELS: Record<string, string> = {
  COUPANG: '쿠팡',
  NAVER: '네이버 스마트스토어',
  ELEVENST: '11번가',
  GMARKET: 'G마켓',
};

interface ChannelDetailsModalProps {
  isOpen: boolean;
  channel: MarketplaceAccount | null;
  sellerName: string;
  onClose: () => void;
  onEditClick?: (channel: MarketplaceAccount) => void;
  onDeleteClick?: (channel: MarketplaceAccount) => void;
  thumbTemplates: TemplateOption[];
  detailTemplates: TemplateOption[];
  /** 고정비 조회용 (FEATURE_2609_33). useCase 는 SellerChannelSection 이 소유해 주입한다. */
  fixedCostUseCase: FixedCostUseCase;
  /** Shipping lookup for the 「배송」 tab (FEATURE_2610_16 / D28). Owned by SellerChannelSection. */
  shippingUseCase: ShippingUseCase;
}

// Resolve an assigned template id to a display name. null id = tenant default;
// a miss (list not yet loaded) falls back to "#<id>".
function templateLabel(id: number | null, templates: TemplateOption[]): string {
  if (id == null) return '기본값 사용';
  return templates.find((t) => t.id === id)?.name ?? `#${id}`;
}

// "옵션확인" 접미사 채널 override 표시 문구. 문구 없음 = 판매자 기본값 상속.
function suffixLabel(suffix?: string | null): string {
  if (suffix == null || suffix.trim() === '') return '미등록시 판매자 설정값 사용';
  return `추가 문구 "${suffix}"`;
}

/**
 * Read-only details modal for a single sales channel (MarketplaceAccount), opened when a channel row is
 * clicked in SellerChannelSection.
 *
 * FEATURE_2610_16 / D26: three tabs — 「기본 정보」 · 「플랫폼 기본값」 · 「배송」 — and every open starts on
 * 「기본 정보」 (the body mounts on open). The platform tab shows only the fields of this channel's platform
 * (D1 · D3 · D4); the shipping tab is read-only (D21 · D27) — it is edited in the edit modal.
 */
export function ChannelDetailsModal(props: ChannelDetailsModalProps) {
  if (!props.isOpen || !props.channel) {
    return null;
  }
  return <ChannelDetailsContent {...props} channel={props.channel} />;
}

function ChannelDetailsContent({
  channel,
  sellerName,
  onClose,
  onEditClick,
  onDeleteClick,
  thumbTemplates,
  detailTemplates,
  fixedCostUseCase,
  shippingUseCase,
}: ChannelDetailsModalProps & { channel: MarketplaceAccount }) {
  const [activeTab, setActiveTab] = useState<ChannelTabKey>('basic');
  const [fixedCosts, setFixedCosts] = useState<AccountFixedCost[]>([]);
  const [fixedCostsLoading, setFixedCostsLoading] = useState(false);
  const [fixedCostsError, setFixedCostsError] = useState('');
  const [shipping, setShipping] = useState<ChannelShippingData | null>(null);
  const [shippingLoading, setShippingLoading] = useState(true);
  const [shippingError, setShippingError] = useState('');
  const isElevenst = channel.platform === 'ELEVENST';

  // 인라인 async IIFE — 이펙트 본문에서 setState 를 동기 호출하지 않기 위한 프로젝트 관례.
  useEffect(() => {
    let alive = true;
    void (async () => {
      setFixedCostsLoading(true);
      setFixedCostsError('');
      try {
        const list = await fixedCostUseCase.listForAccount(channel.id);
        if (alive) setFixedCosts(list);
      } catch {
        if (alive) {
          setFixedCostsError('고정비 목록을 불러오지 못했습니다.');
          setFixedCosts([]);
        }
      } finally {
        if (alive) setFixedCostsLoading(false);
      }
    })();
    // FEATURE_2610_16 / D28: the shipping settings load together with the fixed costs when the modal opens.
    void (async () => {
      try {
        const data = await loadChannelShipping(shippingUseCase, channel);
        if (alive) setShipping(data);
      } catch {
        if (alive) setShippingError('배송 설정을 불러오지 못했습니다.');
      } finally {
        if (alive) setShippingLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [channel, fixedCostUseCase, shippingUseCase]);

  const formatDate = (dateString: string) => new Date(dateString).toISOString().split('T')[0];
  const noticeValues: Record<string, string | null | undefined> = {
    [AS_NOTICE_KEY]: channel.asNotice,
    [RETURN_EXCHANGE_NOTICE_KEY]: channel.returnExchangeNotice,
  };

  // FEATURE_2610_16 / D32 · D33: fixed height, so a tab switch keeps the modal size and the body scrolls instead;
  // [수정] [삭제] sit in the footer, so they stay in view while the body scrolls.
  return (
    <Modal
      isOpen
      onClose={onClose}
      title={`판매채널 정보 — ${sellerName}`}
      fullHeight
      footer={
        onEditClick || onDeleteClick ? (
          <>
            {onEditClick && <Button onClick={() => onEditClick(channel)}>수정</Button>}
            {onDeleteClick && (
              <Button variant="danger" onClick={() => onDeleteClick(channel)}>
                삭제
              </Button>
            )}
          </>
        ) : undefined
      }
    >
      <ChannelTabBar active={activeTab} onSelect={setActiveTab} />

      <div className="p-4">
        <div role="tabpanel" hidden={activeTab !== 'basic'} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">플랫폼</label>
            <p className="text-sm text-gray-900">
              {PLATFORM_LABELS[channel.platform] ?? channel.platform}
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">계정 별칭</label>
            <p className="text-sm text-gray-900">{channel.accountAlias || '-'}</p>
          </div>

          {/* FEATURE_2610_16 / D10: the Coupang credential rows — an 11st channel shows none (its API key is never shown). */}
          {!isElevenst && (
            <>
              <div>
                <label className="block text-sm font-medium mb-1">판매자(벤더) ID</label>
                <p className="text-sm text-gray-900">{channel.vendorId || '-'}</p>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">WING 로그인 ID</label>
                <p className="text-sm text-gray-900">{channel.vendorUserId || '-'}</p>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Access Key</label>
                <p className="text-sm text-gray-900 break-all">{channel.accessKey || '-'}</p>
              </div>
            </>
          )}

          <div>
            <label className="block text-sm font-medium mb-1">상태</label>
            <span
              className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
                channel.isActive
                  ? 'bg-green-100 text-green-700'
                  : 'bg-gray-100 text-gray-600'
              }`}
            >
              {channel.isActive ? '활성' : '비활성'}
            </span>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">썸네일 템플릿</label>
            <p className="text-sm text-gray-900">
              {templateLabel(channel.thumbnailTemplateId, thumbTemplates)}
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">상세 템플릿</label>
            <p className="text-sm text-gray-900">
              {templateLabel(channel.detailTemplateId, detailTemplates)}
            </p>
          </div>

          <div>
            {/* 🔴 모드(매출 기준 자동 / 항상 부과 / 부과 안 함)를 반드시 함께 보여준다 —
                모드가 없으면 '부과 안 함'으로 덮은 채널이 '부과 중'처럼 읽힌다. */}
            <label className="block text-sm font-medium mb-1">고정비</label>
            {fixedCostsLoading ? (
              <p className="text-sm text-gray-500">불러오는 중...</p>
            ) : fixedCostsError ? (
              <p className="text-sm text-red-600">{fixedCostsError}</p>
            ) : fixedCosts.length === 0 ? (
              <p className="text-sm text-gray-900">부과 중인 고정비 없음</p>
            ) : (
              <ul className="space-y-2">
                {fixedCosts.map((cost) => {
                  const period = appliedPeriodLabel(cost.appliedFrom, cost.appliedTo);
                  return (
                    <li key={cost.fixedCostId}>
                      <p className="text-sm text-gray-900">
                        {cost.name} 월 {formatFixedCostAmount(cost.amount)}원 ·{' '}
                        {chargeModeLabel(cost.chargeMode)}
                      </p>
                      {cost.chargeMode === 'AUTO' && (
                        <p className="text-xs text-gray-500">
                          기준 {formatFixedCostAmount(cost.thresholdAmount)}원 이상인 달만
                        </p>
                      )}
                      {period && <p className="text-xs text-gray-500">{period}</p>}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">등록일</label>
            <p className="text-sm text-gray-900">{formatDate(channel.createdAt)}</p>
          </div>

          {channel.updatedAt && (
            <div>
              <label className="block text-sm font-medium mb-1">수정일</label>
              <p className="text-sm text-gray-900">{formatDate(channel.updatedAt)}</p>
            </div>
          )}
        </div>

        <div role="tabpanel" hidden={activeTab !== 'platform'} className="space-y-4">
          {isElevenst ? (
            NOTICE_TEXT_FIELDS.map((f) => (
              <div key={f.key}>
                <label className="block text-sm font-medium mb-1">{f.label}</label>
                <p className="text-sm text-gray-900 whitespace-pre-wrap">
                  {noticeValues[f.key]?.trim() ? noticeValues[f.key] : '-'}
                </p>
              </div>
            ))
          ) : (
            <div>
              <label className="block text-sm font-medium mb-1">
                등록상품명 추가 문구{' '}
                <span className="inline-flex rounded-full px-2 py-0.5 text-xs font-medium bg-red-100 text-red-700">
                  쿠팡
                </span>
              </label>
              <p className="text-sm text-gray-900">
                {suffixLabel(channel.optionCheckSuffix)}
              </p>
            </div>
          )}
        </div>

        <div role="tabpanel" hidden={activeTab !== 'shipping'} className="space-y-4">
          {shippingLoading ? (
            <p className="text-sm text-gray-500">불러오는 중...</p>
          ) : shippingError || !shipping ? (
            <p className="text-sm text-red-600">{shippingError}</p>
          ) : (
            <ChannelShippingSummary platform={channel.platform} data={shipping} />
          )}
        </div>
      </div>
    </Modal>
  );
}
