'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Plus } from 'lucide-react';
import { MarketplaceAccountRepositoryImpl } from '@/infrastructure/repositories/MarketplaceAccountRepositoryImpl';
import { MarketplaceAccountUseCase } from '@/application/usecases/MarketplaceAccountUseCase';
import type { MarketplaceAccount } from '@/domain/entities/MarketplaceAccountEntity';
import type { CreateMarketplaceAccountForm } from '@/application/dto/MarketplaceAccountDTOs';
import { CreateChannelModal } from './CreateChannelModal';
import { ChannelDetailsModal } from './ChannelDetailsModal';

interface SellerChannelSectionProps {
  sellerId: number;
  sellerName: string;
}

/**
 * Sales-channel (MarketplaceAccount) section that expands when a seller row is toggled.
 *
 * Self-manages the channel list query and the create-modal state for its seller.
 * Loads channels via `GET /api/admin/marketplace-account?sellerId=X`.
 */
export function SellerChannelSection({ sellerId, sellerName }: SellerChannelSectionProps) {
  const [channels, setChannels] = useState<MarketplaceAccount[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isModalLoading, setIsModalLoading] = useState(false);
  const [selectedChannel, setSelectedChannel] = useState<MarketplaceAccount | null>(null);

  const useCase = useMemo(() => {
    const repository = new MarketplaceAccountRepositoryImpl();
    return new MarketplaceAccountUseCase(repository);
  }, []);

  const loadChannels = useCallback(async () => {
    try {
      setIsLoading(true);
      setError('');
      const result = await useCase.getBySeller(sellerId);
      setChannels(result);
    } catch {
      setError('판매채널 조회에 실패했습니다. 다시 시도해주세요.');
      setChannels([]);
    } finally {
      setIsLoading(false);
    }
  }, [useCase, sellerId]);

  useEffect(() => {
    const run = async () => {
      await loadChannels();
    };
    run();
  }, [loadChannels]);

  const handleCreateSubmit = async (data: CreateMarketplaceAccountForm) => {
    try {
      setIsModalLoading(true);
      await useCase.create({ sellerId, ...data });
      setIsCreateModalOpen(false);
      await loadChannels();
    } catch (err) {
      throw err;
    } finally {
      setIsModalLoading(false);
    }
  };

  return (
    <div className="bg-gray-50 px-6 py-4 border-t border-gray-200">
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-sm font-semibold text-gray-900">판매채널</h4>
        <button
          onClick={() => setIsCreateModalOpen(true)}
          className="inline-flex items-center gap-1 px-3 py-1.5 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 transition-colors"
        >
          <Plus className="h-4 w-4" />
          판매채널 추가
        </button>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[...Array(2)].map((_, i) => (
            <div key={i} className="h-10 bg-gray-200 rounded animate-pulse" />
          ))}
        </div>
      ) : error ? (
        <div className="bg-red-50 border border-red-200 rounded-md p-3 text-sm text-red-700">
          {error}
        </div>
      ) : channels.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-md p-4 text-center text-sm text-gray-500">
          등록된 판매채널이 없습니다.
        </div>
      ) : (
        <div className="bg-white rounded-md border border-gray-200 overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-100 border-b border-gray-200">
              <tr>
                <th className="px-4 py-2 text-left text-xs font-semibold text-gray-700">플랫폼</th>
                <th className="px-4 py-2 text-left text-xs font-semibold text-gray-700">계정 별칭</th>
                <th className="px-4 py-2 text-left text-xs font-semibold text-gray-700">벤더 ID</th>
                <th className="px-4 py-2 text-left text-xs font-semibold text-gray-700">Access Key</th>
                <th className="px-4 py-2 text-left text-xs font-semibold text-gray-700">상태</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {channels.map((channel) => (
                <tr
                  key={channel.id}
                  onClick={() => setSelectedChannel(channel)}
                  className="cursor-pointer hover:bg-gray-50 transition-colors"
                >
                  <td className="px-4 py-2 text-sm text-gray-700">{channel.platform}</td>
                  <td className="px-4 py-2 text-sm text-gray-700">{channel.accountAlias || '-'}</td>
                  <td className="px-4 py-2 text-sm text-gray-700">{channel.vendorId}</td>
                  <td className="px-4 py-2 text-sm text-gray-700">{channel.accessKey}</td>
                  <td className="px-4 py-2 text-sm">
                    <span
                      className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
                        channel.isActive
                          ? 'bg-green-100 text-green-700'
                          : 'bg-gray-100 text-gray-600'
                      }`}
                    >
                      {channel.isActive ? '활성' : '비활성'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <CreateChannelModal
        isOpen={isCreateModalOpen}
        sellerName={sellerName}
        onClose={() => setIsCreateModalOpen(false)}
        onSubmit={handleCreateSubmit}
        isLoading={isModalLoading}
      />

      <ChannelDetailsModal
        isOpen={selectedChannel !== null}
        channel={selectedChannel}
        sellerName={sellerName}
        onClose={() => setSelectedChannel(null)}
      />
    </div>
  );
}
