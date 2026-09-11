'use client';

import { useEffect, useState } from 'react';
import type { MarketplaceAccount, TemplateOption } from '@/domain/entities/MarketplaceAccountEntity';
import type { AccountFixedCost } from '@/domain/entities/FixedCost';
import {
  appliedPeriodLabel,
  chargeModeLabel,
  formatFixedCostAmount,
} from '@/domain/entities/FixedCost';
import type { FixedCostUseCase } from '@/application/usecases/FixedCostUseCase';
import { Button } from '@/presentation/components/ui/Button';

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
  onShippingClick?: (channel: MarketplaceAccount) => void;
  thumbTemplates: TemplateOption[];
  detailTemplates: TemplateOption[];
  /** 고정비 조회용 (FEATURE_2609_33). useCase 는 SellerChannelSection 이 소유해 주입한다. */
  fixedCostUseCase: FixedCostUseCase;
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
 * Read-only details modal for a single sales channel (MarketplaceAccount).
 *
 * Reuses the same modal chrome as CreateSellerModal/CreateChannelModal
 * (fixed overlay, max-w-md card, header with title + ✕). Opened when a
 * channel row is clicked in SellerChannelSection.
 */
export function ChannelDetailsModal({
  isOpen,
  channel,
  sellerName,
  onClose,
  onEditClick,
  onDeleteClick,
  onShippingClick,
  thumbTemplates,
  detailTemplates,
  fixedCostUseCase,
}: ChannelDetailsModalProps) {
  const [fixedCosts, setFixedCosts] = useState<AccountFixedCost[]>([]);
  const [fixedCostsLoading, setFixedCostsLoading] = useState(false);
  const [fixedCostsError, setFixedCostsError] = useState('');
  const channelId = channel?.id ?? null;

  // 인라인 async IIFE — 이펙트 본문에서 setState 를 동기 호출하지 않기 위한 프로젝트 관례.
  useEffect(() => {
    if (!isOpen || channelId == null) return;
    let alive = true;
    void (async () => {
      setFixedCostsLoading(true);
      setFixedCostsError('');
      try {
        const list = await fixedCostUseCase.listForAccount(channelId);
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
    return () => {
      alive = false;
    };
  }, [isOpen, channelId, fixedCostUseCase]);

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    if (isOpen) {
      window.addEventListener('keydown', handleEsc);
      return () => window.removeEventListener('keydown', handleEsc);
    }
  }, [isOpen, onClose]);

  if (!isOpen || !channel) {
    return null;
  }

  const formatDate = (dateString: string) => new Date(dateString).toISOString().split('T')[0];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-lg shadow-lg max-w-md w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-semibold">판매채널 정보 — {sellerName}</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700"
          >
            ✕
          </button>
        </div>

        <div className="p-4 space-y-4">
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

          <div>
            <label className="block text-sm font-medium mb-1">판매자(벤더) ID</label>
            <p className="text-sm text-gray-900">{channel.vendorId}</p>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">WING 로그인 ID</label>
            <p className="text-sm text-gray-900">{channel.vendorUserId || '-'}</p>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Access Key</label>
            <p className="text-sm text-gray-900 break-all">{channel.accessKey}</p>
          </div>

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
            <label className="block text-sm font-medium mb-1">등록상품명 추가 문구</label>
            <p className="text-sm text-gray-900">
              {suffixLabel(channel.optionCheckSuffix)}
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

        {(onEditClick || onDeleteClick || onShippingClick) && (
          <div className="border-t p-4 flex gap-2">
            {onShippingClick && (
              <button
                onClick={() => onShippingClick(channel)}
                className="flex-1 px-4 py-2 bg-gray-700 text-white rounded-md hover:bg-gray-800 transition-colors text-sm font-medium"
              >
                배송관리
              </button>
            )}
            {onEditClick && (
              <button
                onClick={() => onEditClick(channel)}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors text-sm font-medium"
              >
                수정
              </button>
            )}
            {onDeleteClick && (
              <Button
                onClick={() => onDeleteClick(channel)}
                variant="danger"
                className="flex-1"
              >
                삭제
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
