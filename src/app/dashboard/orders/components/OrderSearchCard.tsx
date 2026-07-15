'use client';

import { Download, Upload } from 'lucide-react';
import type { Seller } from '@/domain/entities/SellerEntity';
import { Spinner } from '@/presentation/components/Spinner';

interface OrderSearchCardProps {
  sellers: Seller[];
  selectedSellerId: number | '';
  onSellerChange: (value: number | '') => void;
  onSearch: () => void;
  onSync: () => void;
  isLoading: boolean;
  isSyncing: boolean;
  resultCount: number;
  lastSyncedAt: string | null;
  canDownload: boolean;
  isDownloading: boolean;
  onDownload: () => void;
  onOpenConfirm: () => void;
}

function formatSyncedAt(value: string | null): string {
  if (!value) return '동기화 기록 없음';
  const date = new Date(value);
  if (isNaN(date.getTime())) return '동기화 기록 없음';
  return date.toLocaleString('ko-KR');
}

export function OrderSearchCard({
  sellers,
  selectedSellerId,
  onSellerChange,
  onSearch,
  onSync,
  isLoading,
  isSyncing,
  resultCount,
  lastSyncedAt,
  canDownload,
  isDownloading,
  onDownload,
  onOpenConfirm,
}: OrderSearchCardProps) {
  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-semibold text-gray-900">주문내역</h2>
        <p className="text-sm text-gray-500">
          마지막 동기화: <span className="font-medium text-gray-700">{formatSyncedAt(lastSyncedAt)}</span>
        </p>
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">판매자</label>
          <div className="flex items-center gap-2">
            <select
              value={selectedSellerId}
              onChange={(e) => onSellerChange(e.target.value === '' ? '' : Number(e.target.value))}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
            >
              <option value="">전체</option>
              {sellers.map((seller) => (
                <option key={seller.id} value={seller.id}>
                  {seller.sellerName}
                </option>
              ))}
            </select>
            {canDownload && (
              <button
                onClick={onDownload}
                disabled={isDownloading}
                className="flex items-center gap-2 whitespace-nowrap px-4 py-2 border border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-gray-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isDownloading ? (
                  <Spinner label="다운로드 중..." />
                ) : (
                  <>
                    <Download size={16} />
                    주문목록 다운로드
                  </>
                )}
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
