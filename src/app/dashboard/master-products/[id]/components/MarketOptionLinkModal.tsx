'use client';

import { useEffect, useMemo, useState } from 'react';
import { Spinner } from '@/presentation/components/Spinner';
import { Button } from '@/presentation/components/ui/Button';
import { Modal } from '@/presentation/components/ui/Modal';
import { ListingRegistrationUseCase } from '@/application/usecases/ListingRegistrationUseCase';
import { ListingRegistrationRepositoryImpl } from '@/infrastructure/repositories/ListingRegistrationRepositoryImpl';
import { extractErrorMessage } from '@/infrastructure/utils/errorMessage';
import type { MarketOption } from '@/domain/entities/ListingRegistrationEntity';

interface MarketOptionLinkModalProps {
  listingId: number;
  /** 옵션 ID 가 비어 있는 우리 채널 옵션. */
  optionId: number;
  optionName: string;
  onClose: () => void;
  /** 연결 저장 성공. 부모가 다시 읽는다. */
  onLinked: () => void;
}

const formatWon = (v: number) => `${v.toLocaleString('ko-KR')}원`;

/**
 * 쿠팡 옵션 연결 (2609_74/D13).
 * File: src/app/dashboard/master-products/[id]/components/MarketOptionLinkModal.tsx
 *
 * 옵션 ID 를 받지 못한 채널 옵션을, 쿠팡에 실제로 있는 옵션 중 하나와 **사람이 골라** 잇는다.
 * 쿠팡이 옵션명을 바꿔 자동으로 짝을 찾지 못한 경우의 복구 창구다.
 *
 * - 열리면 쿠팡에서 옵션 목록을 읽는다(쿠팡 호출 1회). 캐시하지 않는다.
 * - 🔴 자동으로 골라 두지 않는다 — 이름이 비슷하다는 이유로 미리 선택하면 틀린 연결이 조용히 저장된다.
 * - 고를 수 없는 줄: 옵션 ID 가 아직 없는 쿠팡 옵션(승인 전) · 이미 다른 옵션에 연결된 쿠팡 옵션.
 */
export function MarketOptionLinkModal({
  listingId,
  optionId,
  optionName,
  onClose,
  onLinked,
}: MarketOptionLinkModalProps) {
  const useCase = useMemo(
    () => new ListingRegistrationUseCase(new ListingRegistrationRepositoryImpl()),
    [],
  );

  const [marketOptions, setMarketOptions] = useState<MarketOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [picked, setPicked] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        const res = await useCase.getMarketOptions(listingId);
        if (!alive) return;
        setMarketOptions(res);
      } catch (e: unknown) {
        if (!alive) return;
        setError(extractErrorMessage(e, '쿠팡 옵션을 불러오지 못했습니다.'));
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [useCase, listingId]);

  const handleLink = async () => {
    if (picked == null || saving) return;
    setSaving(true);
    setError('');
    try {
      await useCase.linkMarketOption(listingId, optionId, { vendorItemId: picked });
      onLinked();
      onClose();
    } catch (e: unknown) {
      setError(extractErrorMessage(e, '쿠팡 옵션 연결에 실패했습니다.'));
    } finally {
      setSaving(false);
    }
  };

  const blockedReason = (o: MarketOption): string | null => {
    if (o.vendorItemId == null) return '승인 전 — 옵션 ID 가 없어 연결할 수 없습니다';
    if (o.linkedOptionId != null) return `이미 연결됨 — ${o.linkedOptionName ?? '다른 옵션'}`;
    return null;
  };

  return (
    <Modal
      isOpen
      onClose={onClose}
      title="쿠팡 옵션 연결"
      disableClose={saving}
      isDirty={picked != null}
      footer={
        <>
          <Button type="button" variant="secondary" size="sm" onClick={onClose} disabled={saving}>
            취소
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={handleLink}
            disabled={picked == null || saving}
            isLoading={saving}
            loadingText="연결 중…"
          >
            연결
          </Button>
        </>
      }
    >
      <p className="text-sm text-gray-700">
        <span className="font-medium text-gray-900">{optionName}</span> 옵션과 이을 쿠팡 옵션을
        고르세요.
      </p>

      {error && <p className="mt-3 rounded bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      <div className="mt-3">
        {loading ? (
          <Spinner size={14} label="쿠팡에서 불러오는 중" />
        ) : marketOptions.length === 0 ? (
          !error && <p className="text-sm text-gray-500">쿠팡에 옵션이 없습니다.</p>
        ) : (
          <ul className="divide-y divide-gray-100 rounded border border-gray-200">
            {marketOptions.map((o, index) => {
              const reason = blockedReason(o);
              return (
                <li key={o.vendorItemId ?? `pending-${index}`} className="px-3 py-2">
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="market-option"
                      disabled={reason != null || saving}
                      checked={o.vendorItemId != null && picked === o.vendorItemId}
                      onChange={() => setPicked(o.vendorItemId)}
                    />
                    <span className="min-w-0 flex-1">
                      <span
                        className={`block truncate text-sm ${
                          reason != null ? 'text-gray-400' : 'text-gray-900'
                        }`}
                        title={o.itemName ?? undefined}
                      >
                        {o.itemName ?? '(이름 없음)'}
                      </span>
                      <span className="block text-xs text-gray-500">
                        {o.vendorItemId != null && (
                          <span className="font-mono tabular-nums">{o.vendorItemId}</span>
                        )}
                        {o.vendorItemId != null && o.salePrice != null && ' · '}
                        {o.salePrice != null && formatWon(o.salePrice)}
                      </span>
                      {reason != null && (
                        <span className="block text-[11px] text-gray-500">{reason}</span>
                      )}
                    </span>
                  </label>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <p className="mt-3 text-[11px] text-gray-500">
        연결하면 이 옵션에 쿠팡 옵션 ID 가 저장됩니다. 쿠팡에는 아무것도 전송하지 않습니다.
      </p>
    </Modal>
  );
}
