'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Plus } from 'lucide-react';
import { SellerCardRepositoryImpl } from '@/infrastructure/repositories/SellerCardRepositoryImpl';
import { SellerCardUseCase } from '@/application/usecases/SellerCardUseCase';
import type { SellerCard } from '@/domain/entities/SellerCardEntity';
import { toast } from '@/infrastructure/stores/toastStore';
import { extractErrorMessage } from '@/infrastructure/utils/errorMessage';
import { ConfirmDialog } from '@/presentation/components/ui/ConfirmDialog';
import { SellerCardModal } from './SellerCardModal';

interface SellerCardSectionProps {
  sellerId: number;
  sellerName: string;
}

/**
 * Payment-card section under an expanded seller row (FEATURE_2610_18 D29 · D52 · D91).
 *
 * The receipt popup tells the payer seller by these cards. [카드 추가] · [수정] (alias and masked number) · [삭제]
 * (hide — receipts already saved with the card keep showing its alias). Loads `GET /api/admin/seller-cards` and keeps
 * this seller's rows. The seller table shows it only when the tenant has more than one seller (D53).
 */
export function SellerCardSection({ sellerId, sellerName }: SellerCardSectionProps) {
  const useCase = useMemo(() => new SellerCardUseCase(new SellerCardRepositoryImpl()), []);
  const [cards, setCards] = useState<SellerCard[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editCard, setEditCard] = useState<SellerCard | null>(null);
  const [deleteCard, setDeleteCard] = useState<SellerCard | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const loadCards = useCallback(async () => {
    setIsLoading(true);
    setError('');
    try {
      const all = await useCase.getVisible();
      setCards(all.filter((card) => card.sellerId === sellerId));
    } catch {
      setError('카드 목록을 불러오지 못했습니다.');
      setCards([]);
    } finally {
      setIsLoading(false);
    }
  }, [useCase, sellerId]);

  useEffect(() => {
    void (async () => {
      await loadCards();
    })();
  }, [loadCards]);

  const openCreate = () => {
    setEditCard(null);
    setIsModalOpen(true);
  };

  const openEdit = (card: SellerCard) => {
    setEditCard(card);
    setIsModalOpen(true);
  };

  const handleSubmit = async (data: { alias: string; maskedNumber: string }) => {
    if (editCard) {
      await useCase.update(editCard.id, data);
    } else {
      await useCase.create({ sellerId, ...data });
    }
    setIsModalOpen(false);
    toast.success('카드를 저장했습니다.');
    await loadCards();
  };

  const handleDelete = async () => {
    if (!deleteCard) return;
    setIsDeleting(true);
    try {
      await useCase.hide(deleteCard.id);
      setDeleteCard(null);
      toast.success('카드를 삭제했습니다.');
      await loadCards();
    } catch (err) {
      toast.error(extractErrorMessage(err, '카드를 삭제하지 못했습니다.'));
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="bg-gray-50 px-6 py-4 border-t border-gray-200">
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-sm font-semibold text-gray-900">결제 카드</h4>
        <button
          onClick={openCreate}
          className="inline-flex items-center gap-1 px-3 py-1.5 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 transition-colors"
        >
          <Plus className="h-4 w-4" />
          카드 추가
        </button>
      </div>

      {isLoading ? (
        <div className="h-10 bg-gray-200 rounded animate-pulse" />
      ) : error ? (
        <div className="bg-red-50 border border-red-200 rounded-md p-3 text-sm text-red-700">{error}</div>
      ) : cards.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-md p-4 text-center text-sm text-gray-500">
          등록된 카드가 없습니다.
        </div>
      ) : (
        <div className="bg-white rounded-md border border-gray-200 list-table-scroll">
          <table className="w-full">
            <thead className="bg-gray-100 border-b border-gray-200">
              <tr>
                <th className="px-4 py-2 text-left text-xs font-semibold text-gray-700">별칭</th>
                <th className="px-4 py-2 text-left text-xs font-semibold text-gray-700">가려진 번호</th>
                <th className="px-4 py-2 text-right text-xs font-semibold text-gray-700">작업</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {cards.map((card) => (
                <tr key={card.id}>
                  <td className="px-4 py-2 text-sm text-gray-700">{card.alias}</td>
                  <td className="px-4 py-2 text-sm text-gray-700">{card.maskedNumber}</td>
                  <td className="px-4 py-2 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        type="button"
                        onClick={() => openEdit(card)}
                        className="px-2 py-0.5 text-xs border border-gray-300 rounded text-gray-700 hover:bg-gray-100"
                      >
                        수정
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeleteCard(card)}
                        className="px-2 py-0.5 text-xs border border-gray-300 rounded text-red-600 hover:bg-red-50"
                      >
                        삭제
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <SellerCardModal
        isOpen={isModalOpen}
        sellerName={sellerName}
        card={editCard}
        onClose={() => setIsModalOpen(false)}
        onSubmit={handleSubmit}
      />

      <ConfirmDialog
        isOpen={deleteCard !== null}
        title="카드 삭제"
        message={
          deleteCard
            ? `${deleteCard.alias} 카드를 삭제합니다. 이미 넣은 영수증에는 카드 별칭이 그대로 보입니다.`
            : ''
        }
        confirmText="삭제"
        onConfirm={() => void handleDelete()}
        onCancel={() => setDeleteCard(null)}
        isDangerous
        isLoading={isDeleting}
      />
    </div>
  );
}
