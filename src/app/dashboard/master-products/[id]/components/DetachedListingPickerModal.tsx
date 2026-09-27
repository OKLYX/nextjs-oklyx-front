'use client';

import { useEffect, useMemo, useState } from 'react';
import { Spinner } from '@/presentation/components/Spinner';
import { Modal } from '@/presentation/components/ui/Modal';
import { ListingRegistrationUseCase } from '@/application/usecases/ListingRegistrationUseCase';
import { ListingRegistrationRepositoryImpl } from '@/infrastructure/repositories/ListingRegistrationRepositoryImpl';
import { extractErrorMessage } from '@/infrastructure/utils/errorMessage';
import type { DetachedListing } from '@/domain/entities/ListingRegistrationEntity';

interface DetachedListingPickerModalProps {
  masterId: number;
  sellerId: number;
  platform: string;
  sellerName: string;
  onClose: () => void;
  /** 고른 판매상품의 쿠팡 상품 ID. 부모가 이 값으로 가져오기 모달을 연다. */
  onPick: (platformProductId: string) => void;
}

// 상태 enum → 화면 문구. CoverageMatrix 가 이 모달을 import 하므로 거기서 가져오면 순환 참조가 된다.
const STATUS_LABEL: Record<string, string> = {
  DRAFT: '미전송',
  SUBMITTED: '승인 대기중',
  SELLING: '판매중',
  REJECTED: '승인 반려',
  SUSPENDED: '판매 중지',
};

/**
 * 미연결 판매상품 고르기 (2609_74/D1·D14).
 * File: src/app/dashboard/master-products/[id]/components/DetachedListingPickerModal.tsx
 *
 * 마스터 연결이 끊긴 판매상품 중 **이 계정(판매자·플랫폼)의 것만** 보여주고, 하나를 고르면 부모가
 * 그 쿠팡 상품 ID 로 [쿠팡 상품 가져오기] 모달을 연다. 다시 붙이는 처리는 가져오기가 한다 — 이 모달은
 * 쿠팡 상품 ID 를 손으로 입력하는 단계를 없앨 뿐이다.
 *
 * - 열리면 바로 조회한다(검색어 없음 = 최근 20건). [검색] 은 이름 부분일치 · 쿠팡 상품 ID 완전일치.
 * - 🔴 여기서 연결을 저장하지 않는다. 저장은 가져오기 모달의 [가져오기] 하나뿐이다.
 * - ⚠️ 목록을 캐시하지 않는다. 모달을 닫으면 버린다.
 */
export function DetachedListingPickerModal({
  masterId,
  sellerId,
  platform,
  sellerName,
  onClose,
  onPick,
}: DetachedListingPickerModalProps) {
  const useCase = useMemo(
    () => new ListingRegistrationUseCase(new ListingRegistrationRepositoryImpl()),
    [],
  );

  const [draft, setDraft] = useState('');
  const [keyword, setKeyword] = useState('');
  const [items, setItems] = useState<DetachedListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        const res = await useCase.findDetachedListings(masterId, {
          sellerId,
          platform,
          keyword: keyword === '' ? undefined : keyword,
        });
        if (!alive) return;
        setItems(res);
        setError('');
      } catch (e: unknown) {
        if (!alive) return;
        setItems([]);
        setError(extractErrorMessage(e, '미연결 판매상품을 불러오지 못했습니다.'));
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [useCase, masterId, sellerId, platform, keyword]);

  const handleSearch = () => {
    const next = draft.trim();
    // 같은 검색어면 effect 가 다시 돌지 않는다 → 로딩을 켜면 영영 꺼지지 않는다.
    if (next === keyword) return;
    setLoading(true);
    setKeyword(next);
  };

  return (
    <Modal isOpen onClose={onClose} title="미연결 판매상품 연결">
      <p className="truncate text-xs text-gray-500">
        {sellerName} · {platform}
      </p>

      <div className="my-3 flex items-center gap-2">
        <input
          type="text"
          aria-label="판매상품 검색어"
          placeholder="상품명 또는 쿠팡 상품 ID"
          className="min-w-0 flex-1 rounded border border-gray-300 px-2 py-1 text-sm text-gray-900"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              handleSearch();
            }
          }}
        />
        <button
          type="button"
          onClick={handleSearch}
          disabled={loading}
          className="rounded border border-blue-300 px-3 py-1 text-sm font-medium text-blue-700 hover:bg-blue-50 disabled:opacity-50"
        >
          검색
        </button>
      </div>

      {error && <p className="mb-3 rounded bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      {loading ? (
        <Spinner size={14} label="불러오는 중" />
      ) : items.length === 0 ? (
        !error && (
          <p className="text-sm text-gray-500">이 계정에 마스터 연결이 끊긴 판매상품이 없습니다.</p>
        )
      ) : (
        <ul className="divide-y divide-gray-100 rounded border border-gray-200">
          {items.map((item) => (
            <li key={item.productListingId} className="flex items-center gap-2 px-3 py-2">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-gray-900" title={item.name}>
                  {item.name}
                </p>
                <p className="text-xs text-gray-500">
                  <span className="font-mono tabular-nums">{item.platformProductId}</span>
                  {' · '}
                  {STATUS_LABEL[item.status] ?? item.status}
                </p>
              </div>
              <button
                type="button"
                onClick={() => onPick(item.platformProductId)}
                className="shrink-0 rounded border border-blue-300 px-2 py-1 text-xs font-medium text-blue-700 hover:bg-blue-50"
              >
                선택
              </button>
            </li>
          ))}
        </ul>
      )}

      <p className="mt-3 text-[11px] text-gray-500">
        최근 20건까지 보여줍니다. 찾는 판매상품이 없으면 상품명이나 쿠팡 상품 ID 로 검색하세요.
      </p>
    </Modal>
  );
}
