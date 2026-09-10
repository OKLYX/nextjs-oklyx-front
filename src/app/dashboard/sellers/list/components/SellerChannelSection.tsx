'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Plus } from 'lucide-react';
import { MarketplaceAccountRepositoryImpl } from '@/infrastructure/repositories/MarketplaceAccountRepositoryImpl';
import { MarketplaceAccountUseCase } from '@/application/usecases/MarketplaceAccountUseCase';
import { ThumbnailTemplateRepositoryImpl } from '@/infrastructure/repositories/ThumbnailTemplateRepositoryImpl';
import { ThumbnailTemplateUseCase } from '@/application/usecases/ThumbnailTemplateUseCase';
import { DetailContentRepositoryImpl } from '@/infrastructure/repositories/DetailContentRepositoryImpl';
import { DetailContentUseCase } from '@/application/usecases/DetailContentUseCase';
import { ShippingRepositoryImpl } from '@/infrastructure/repositories/ShippingRepositoryImpl';
import { ShippingUseCase } from '@/application/usecases/ShippingUseCase';
import { FixedCostRepositoryImpl } from '@/infrastructure/repositories/FixedCostRepositoryImpl';
import { FixedCostUseCase } from '@/application/usecases/FixedCostUseCase';
import type { PlatformFixedCost } from '@/domain/entities/FixedCost';
import type { MarketplaceAccount, TemplateOption } from '@/domain/entities/MarketplaceAccountEntity';
import type { CreateMarketplaceAccountForm } from '@/application/dto/MarketplaceAccountDTOs';
import { CreateChannelModal } from './CreateChannelModal';
import { ChannelDetailsModal } from './ChannelDetailsModal';
import { EditChannelModal } from './EditChannelModal';
import { DeleteChannelConfirmation } from './DeleteChannelConfirmation';
import { ShippingConfigModal } from './ShippingConfigModal';

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
  const [editChannel, setEditChannel] = useState<MarketplaceAccount | null>(null);
  const [deleteChannel, setDeleteChannel] = useState<MarketplaceAccount | null>(null);
  const [isDeleteLoading, setIsDeleteLoading] = useState(false);
  const [shippingChannel, setShippingChannel] = useState<MarketplaceAccount | null>(null);
  const [fixedCosts, setFixedCosts] = useState<PlatformFixedCost[]>([]);
  const [fixedCostsLoading, setFixedCostsLoading] = useState(false);
  const [fixedCostsError, setFixedCostsError] = useState('');
  const [thumbTemplates, setThumbTemplates] = useState<TemplateOption[]>([]);
  const [detailTemplates, setDetailTemplates] = useState<TemplateOption[]>([]);
  const [templatesLoading, setTemplatesLoading] = useState(false);

  const useCase = useMemo(() => {
    const repository = new MarketplaceAccountRepositoryImpl();
    return new MarketplaceAccountUseCase(repository);
  }, []);

  const thumbnailTemplateUseCase = useMemo(
    () => new ThumbnailTemplateUseCase(new ThumbnailTemplateRepositoryImpl()),
    [],
  );
  const detailContentUseCase = useMemo(
    () => new DetailContentUseCase(new DetailContentRepositoryImpl()),
    [],
  );
  const shippingUseCase = useMemo(() => new ShippingUseCase(new ShippingRepositoryImpl()), []);
  const fixedCostUseCase = useMemo(() => new FixedCostUseCase(new FixedCostRepositoryImpl()), []);

  // 고정비 카탈로그는 채널 상세·수정이 함께 쓰므로 섹션이 한 번 로드해 prop 으로 내린다
  // (모달·폼 안에서 useCase 를 새로 만들지 않는다). 🔴 조회 실패를 "등록된 항목 없음" 으로
  // 흘리지 않도록 에러를 그대로 들고 내려간다 — 이미 등록한 사용자에게 거짓 안내가 된다.
  const loadFixedCosts = useCallback(async () => {
    setFixedCostsLoading(true);
    setFixedCostsError('');
    try {
      setFixedCosts(await fixedCostUseCase.list());
    } catch {
      setFixedCostsError('고정비 목록을 불러오지 못했습니다.');
      setFixedCosts([]);
    } finally {
      setFixedCostsLoading(false);
    }
  }, [fixedCostUseCase]);

  // 인라인 async IIFE — 이펙트 본문에서 setState 를 동기 호출하지 않기 위한 프로젝트 관례.
  useEffect(() => {
    void (async () => {
      await loadFixedCosts();
    })();
  }, [loadFixedCosts]);

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

  // Template lists are secondary data: failures degrade the dropdowns to
  // "use default" only (console.error), they never block channel CRUD.
  useEffect(() => {
    let cancelled = false;
    const loadTemplates = async () => {
      setTemplatesLoading(true);
      const [thumb, detail] = await Promise.all([
        thumbnailTemplateUseCase.list().catch((err) => {
          console.error('썸네일 템플릿 목록 조회 실패', err);
          return [] as TemplateOption[];
        }),
        detailContentUseCase.listTemplates().catch((err) => {
          console.error('상세 템플릿 목록 조회 실패', err);
          return [] as TemplateOption[];
        }),
      ]);
      if (!cancelled) {
        setThumbTemplates(thumb);
        setDetailTemplates(detail);
        setTemplatesLoading(false);
      }
    };
    loadTemplates();
    return () => {
      cancelled = true;
    };
  }, [thumbnailTemplateUseCase, detailContentUseCase]);

  const handleCreateSubmit = async (data: CreateMarketplaceAccountForm) => {
    try {
      setIsModalLoading(true);
      await useCase.create({
        sellerId,
        platform: data.platform,
        accountAlias: data.accountAlias,
        vendorId: data.vendorId,
        vendorUserId: data.vendorUserId || undefined,
        accessKey: data.accessKey,
        secretKey: data.secretKey,
        // '' = unassigned = tenant-default fallback (not sent to backend).
        thumbnailTemplateId: data.thumbnailTemplateId ? Number(data.thumbnailTemplateId) : undefined,
        detailTemplateId: data.detailTemplateId ? Number(data.detailTemplateId) : undefined,
      });
      setIsCreateModalOpen(false);
      await loadChannels();
    } catch (err) {
      throw err;
    } finally {
      setIsModalLoading(false);
    }
  };

  const handleEditSuccess = async () => {
    setEditChannel(null);
    setSelectedChannel(null);
    await loadChannels();
  };

  const handleDeleteConfirm = async () => {
    if (!deleteChannel) return;
    try {
      setIsDeleteLoading(true);
      await useCase.delete(deleteChannel.id);
      setDeleteChannel(null);
      setSelectedChannel(null);
      await loadChannels();
    } finally {
      setIsDeleteLoading(false);
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
        <div className="bg-white rounded-md border border-gray-200 list-table-scroll">
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
        thumbTemplates={thumbTemplates}
        detailTemplates={detailTemplates}
        templatesLoading={templatesLoading}
      />

      <ChannelDetailsModal
        isOpen={selectedChannel !== null}
        channel={selectedChannel}
        sellerName={sellerName}
        onClose={() => setSelectedChannel(null)}
        onEditClick={(channel) => setEditChannel(channel)}
        onDeleteClick={(channel) => setDeleteChannel(channel)}
        onShippingClick={(channel) => setShippingChannel(channel)}
        thumbTemplates={thumbTemplates}
        detailTemplates={detailTemplates}
        fixedCostUseCase={fixedCostUseCase}
      />

      <ShippingConfigModal
        isOpen={shippingChannel !== null}
        account={shippingChannel}
        onClose={() => setShippingChannel(null)}
        useCase={shippingUseCase}
      />

      <EditChannelModal
        isOpen={editChannel !== null}
        channel={editChannel}
        sellerName={sellerName}
        onClose={() => setEditChannel(null)}
        onSuccess={handleEditSuccess}
        thumbTemplates={thumbTemplates}
        detailTemplates={detailTemplates}
        templatesLoading={templatesLoading}
        fixedCostUseCase={fixedCostUseCase}
        fixedCosts={fixedCosts}
        fixedCostsLoading={fixedCostsLoading}
        fixedCostsError={fixedCostsError}
        onReloadFixedCosts={loadFixedCosts}
      />

      <DeleteChannelConfirmation
        isOpen={deleteChannel !== null}
        channelLabel={deleteChannel?.accountAlias || deleteChannel?.platform || ''}
        onConfirm={handleDeleteConfirm}
        onCancel={() => setDeleteChannel(null)}
        isLoading={isDeleteLoading}
      />
    </div>
  );
}
