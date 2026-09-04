'use client';

import { Download, Upload } from 'lucide-react';
import type { Seller } from '@/domain/entities/SellerEntity';
import type { ChannelOption } from '../../components/OrderSearchCard';

/**
 * 출고관리 화면의 필터·액션 카드.
 *
 * **용도**: 판매자·채널 선택 + [동기화]/[조회] + ADMIN 전용 [송장 접수시트]/[발송처리].
 * **파일**: src/app/dashboard/orders/shipment/components/ShipmentFilterCard.tsx
 *
 * ⚠️ 주문내역의 `OrderSearchCard` 를 재사용하지 않는다(PLAN 2609_15 D12) — 출고관리는 기간·검색이
 * 없고 액션 구성이 달라, 토글 props 를 계속 붙이면 카드가 두 화면의 분기 덩어리가 된다.
 * 목록 표·모달은 그대로 재사용하므로 D12 의 취지는 지켜진다.
 * ⚠️ 접수시트·발송처리는 서버가 `sellerId` 기준으로 처리한다 — 채널 필터가 적용되지 않는다.
 */
interface ShipmentFilterCardProps {
  sellers: Seller[];
  selectedSellerId: number | '';
  onSellerChange: (value: number | '') => void;
  channelOptions: ChannelOption[];
  selectedAccountId: number | '';
  onAccountChange: (value: number | '') => void;
  onSearch: () => void;
  onSync: () => void;
  isLoading: boolean;
  isSyncing: boolean;
  resultCount: number;
  lastSyncedAt: string | null;
  /** ADMIN 전용 액션 2개(접수시트·발송처리)의 권한 게이트. */
  canDownload: boolean;
  onDownload: () => void;
  onOpenConfirm: () => void;
}

function formatSyncedAt(value: string | null): string {
  if (!value) return '동기화 기록 없음';
  const date = new Date(value);
  if (isNaN(date.getTime())) return '동기화 기록 없음';
  return date.toLocaleString('ko-KR');
}

export function ShipmentFilterCard({
  sellers,
  selectedSellerId,
  onSellerChange,
  channelOptions,
  selectedAccountId,
  onAccountChange,
  onSearch,
  onSync,
  isLoading,
  isSyncing,
  resultCount,
  lastSyncedAt,
  canDownload,
  onDownload,
  onOpenConfirm,
}: ShipmentFilterCardProps) {
  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <h2 className="text-2xl font-semibold text-gray-900">출고관리</h2>
          <p className="mt-1 text-sm text-gray-500">
            목록은 최근 14일 기준입니다. 접수시트는 30일까지 포함합니다.
          </p>
        </div>
        <p className="text-sm text-gray-500 whitespace-nowrap">
          마지막 동기화: <span className="font-medium text-gray-700">{formatSyncedAt(lastSyncedAt)}</span>
        </p>
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">판매자</label>
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={selectedSellerId}
              onChange={(e) => onSellerChange(e.target.value === '' ? '' : Number(e.target.value))}
              className="flex-1 min-w-40 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
            >
              <option value="">전체</option>
              {sellers.map((seller) => (
                <option key={seller.id} value={seller.id}>
                  {seller.sellerName}
                </option>
              ))}
            </select>
            <select
              value={selectedAccountId}
              onChange={(e) => onAccountChange(e.target.value === '' ? '' : Number(e.target.value))}
              aria-label="채널"
              className="w-48 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
            >
              <option value="">전체 채널</option>
              {channelOptions.map((option) => (
                <option key={option.accountId} value={option.accountId}>
                  {option.label}
                </option>
              ))}
            </select>
            {canDownload && (
              <button
                onClick={onDownload}
                className="flex items-center gap-2 whitespace-nowrap px-4 py-2 border border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-gray-100 transition-colors"
              >
                <Download size={16} />
                송장 접수시트
              </button>
            )}
            {canDownload && (
              <button
                onClick={onOpenConfirm}
                className="flex items-center gap-2 whitespace-nowrap px-4 py-2 border border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-gray-100 transition-colors"
              >
                <Upload size={16} />
                발송처리
              </button>
            )}
          </div>
          {/* 두 액션은 서버가 sellerId 로 처리하므로 채널을 골라도 전 채널이 대상이다. */}
          {canDownload && selectedAccountId !== '' && (
            <p className="mt-2 text-xs text-gray-500">
              접수시트·발송처리는 선택한 판매자의 전 채널을 포함합니다.
            </p>
          )}
        </div>

        <div className="flex items-center justify-between">
          <div>
            {resultCount > 0 && (
              <p className="text-sm text-gray-600">{resultCount}개의 결과</p>
            )}
          </div>
          <div className="flex gap-2">
            <button
              onClick={onSync}
              disabled={isSyncing}
              className="px-6 py-2 bg-green-600 text-white font-semibold rounded-lg hover:bg-green-700 transition-colors disabled:bg-green-400 disabled:cursor-not-allowed"
            >
              {isSyncing ? '동기화 중...' : '동기화'}
            </button>
            <button
              onClick={onSearch}
              disabled={isLoading}
              className="px-6 py-2 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors disabled:bg-blue-400 disabled:cursor-not-allowed"
            >
              {isLoading ? '조회 중...' : '조회'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
