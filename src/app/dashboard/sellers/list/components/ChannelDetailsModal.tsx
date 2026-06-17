'use client';

import { useEffect } from 'react';
import type { MarketplaceAccount } from '@/domain/entities/MarketplaceAccountEntity';

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
}: ChannelDetailsModalProps) {
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

        {(onEditClick || onDeleteClick) && (
          <div className="border-t p-4 flex gap-2">
            {onEditClick && (
              <button
                onClick={() => onEditClick(channel)}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors text-sm font-medium"
              >
                수정
              </button>
            )}
            {onDeleteClick && (
              <button
                onClick={() => onDeleteClick(channel)}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors text-sm font-medium"
              >
                삭제
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
