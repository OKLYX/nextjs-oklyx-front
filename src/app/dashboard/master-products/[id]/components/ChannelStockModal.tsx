'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Spinner } from '@/presentation/components/Spinner';
import { ListingRegistrationUseCase } from '@/application/usecases/ListingRegistrationUseCase';
import { ListingRegistrationRepositoryImpl } from '@/infrastructure/repositories/ListingRegistrationRepositoryImpl';
import { extractErrorMessage } from '@/infrastructure/utils/errorMessage';
import type { ListingOptionSummary } from '@/domain/entities/ListingRegistrationEntity';

interface ChannelStockModalProps {
  listingId: number;
  // "판매자명 · 플랫폼" — which channel these numbers belong to (the matrix has many cells).
  channelLabel: string;
  onSaved: () => void;
  onClose: () => void;
}

/**
 * 채널(셀)별 옵션 재고 편집 모달 (102/103).
 * File: src/app/dashboard/master-products/[id]/components/ChannelStockModal.tsx
 *
 * 마스터 옵션 재고가 기본값이고, 이 모달은 **그 채널만 더 낮은 재고**로 조정한다.
 * - 빈칸 = 상속(마스터 값 사용), `0` = 품절. 둘은 다른 값이라 같은 표시로 뭉개지 않는다.
 * - 상한(`maxStock`)은 **백엔드가 SSOT** — 프론트에서 마스터 옵션 목록으로 재계산하지 않는다.
 * - 저장은 **변경된 행만 담아 1회 bulk PUT**(옵션마다 호출하지 않는다). 변경이 없으면
 *   요청 없이 닫는다 — 백엔드가 빈 배열을 400 으로 막는다.
 * - 비활성(43에서 체크 해제) 옵션은 **숨긴다**(사용자 결정 2026-09-02). 그 채널에서 팔지 않는
 *   옵션의 재고는 화면에서 의미가 없다. 값 자체는 백엔드에 남아 있어 재활성화하면 그대로 살아난다.
 * - 헤더에 `channelLabel`(판매자 · 플랫폼)을 찍는다 — 매트릭스 셀마다 열리는 모달이라
 *   어느 채널을 고치는 중인지 모달 안에서 확인할 수 있어야 한다.
 */
export function ChannelStockModal({
  listingId,
  channelLabel,
  onSaved,
  onClose,
}: ChannelStockModalProps) {
  const useCase = useMemo(
    () => new ListingRegistrationUseCase(new ListingRegistrationRepositoryImpl()),
    [],
  );

  const [rows, setRows] = useState<ListingOptionSummary[]>([]);
  // 행별 입력 버퍼. '' = 상속(저장 시 null 로 전송).
  const [draft, setDraft] = useState<Record<number, number | ''>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  // Hide inactive options and reseed the input buffer from the server values.
  // ⚠️ `?? ''` only — `0`(품절) must stay `0`, never collapse into '' with `||`.
  const applyOptions = useCallback((options: ListingOptionSummary[]) => {
    const visible = options.filter((o) => o.active);
    setRows(visible);
    setDraft(Object.fromEntries(visible.map((o) => [o.optionId, o.stockQuantity ?? ''])));
  }, []);

  useEffect(() => {
    let alive = true;
    (async () => {
      setIsLoading(true);
      setError('');
      try {
        const res = await useCase.getListingOptions(listingId);
        if (!alive) return;
        applyOptions(res.options);
      } catch {
        if (alive) setError('옵션 재고를 불러오지 못했습니다.');
      } finally {
        if (alive) setIsLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [useCase, listingId, applyOptions]);

  // ⚠️ 비교는 항상 `=== ''` — `0`(품절)과 ''(상속)을 falsy 로 뭉개면 안 된다.
  const dirty = rows.filter((r) => (draft[r.optionId] ?? '') !== (r.stockQuantity ?? ''));
  const invalid = rows.some(
    (r) => draft[r.optionId] !== '' && Number(draft[r.optionId]) > r.maxStock,
  );

  const handleSave = async () => {
    if (dirty.length === 0) {
      onClose();
      return;
    }
    setIsSaving(true);
    setError('');
    try {
      const res = await useCase.setOptionStocks(listingId, {
        stocks: dirty.map((r) => ({
          optionId: r.optionId,
          stockQuantity: draft[r.optionId] === '' ? null : Number(draft[r.optionId]),
        })),
      });
      // 이미 등록된 셀은 재고 변경만으로 마켓에 반영되지 않는다. 자동 전송하지 않고 안내만 한다.
      if (res.needsResync) {
        setNotice('등록된 셀입니다 — 마켓 반영은 [수정 요청]이 필요합니다.');
        applyOptions(res.options);
        onSaved();
        return;
      }
      onSaved();
      onClose();
    } catch (e: unknown) {
      // 백엔드 400 문구(상한 초과·소속 아님 등)를 그대로 노출한다.
      setError(extractErrorMessage(e, '재고 저장에 실패했습니다.'));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-lg rounded-lg bg-white p-5 shadow-lg">
        <div className="mb-4 flex items-center justify-between">
          <div className="min-w-0">
            <h2 className="text-lg font-semibold text-gray-900">채널별 재고 설정</h2>
            <p className="truncate text-xs text-gray-500">{channelLabel}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 text-sm text-gray-500 hover:text-gray-800"
          >
            닫기
          </button>
        </div>

        {error && <p className="mb-4 rounded bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
        {notice && (
          <p className="mb-4 rounded bg-amber-50 px-3 py-2 text-sm text-amber-800">{notice}</p>
        )}

        {isLoading ? (
          <div className="flex min-h-32 items-center justify-center">
            <Spinner size={24} label="불러오는 중..." />
          </div>
        ) : rows.length === 0 ? (
          <p className="text-sm text-gray-500">이 채널에 재고를 설정할 활성 옵션이 없습니다.</p>
        ) : (
          <>
            <p className="mb-3 text-[11px] text-gray-500">
              비우면 마스터 재고를 그대로 사용하고, 0은 품절입니다. 마스터 재고보다 크게 설정할 수
              없습니다.
            </p>
            <ul className="max-h-80 space-y-2 overflow-y-auto">
              {rows.map((r) => {
                const value = draft[r.optionId] ?? '';
                const over = value !== '' && Number(value) > r.maxStock;
                return (
                  <li key={r.optionId} className="rounded border border-gray-200 px-3 py-2">
                    <div className="flex items-center gap-2">
                      {/* min-w-0 so a long option name truncates instead of squeezing the badge. */}
                      <span className="min-w-0 flex-1 truncate text-sm text-gray-900">
                        {r.optionName}
                      </span>
                      {value === '' ? (
                        <span className="shrink-0 rounded bg-blue-50 px-1.5 py-0.5 text-[11px] font-medium text-blue-700">
                          마스터 재고 기본값 사용중
                        </span>
                      ) : (
                        Number(value) === 0 && (
                          <span className="shrink-0 rounded bg-red-50 px-1.5 py-0.5 text-[11px] font-medium text-red-700">
                            품절
                          </span>
                        )
                      )}
                      <input
                        type="number"
                        min={0}
                        max={r.maxStock}
                        step={1}
                        className="w-24 rounded border border-gray-300 px-2 py-1 text-sm text-gray-900"
                        placeholder={`마스터 ${r.maxStock}`}
                        value={value}
                        onChange={(e) =>
                          setDraft((prev) => ({
                            ...prev,
                            [r.optionId]: e.target.value === '' ? '' : Number(e.target.value),
                          }))
                        }
                      />
                    </div>
                    {over && (
                      <p className="mt-1 text-[11px] text-red-600">
                        마스터 재고({r.maxStock})보다 클 수 없습니다
                      </p>
                    )}
                  </li>
                );
              })}
            </ul>
          </>
        )}

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={isSaving}
            className="rounded border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-100 disabled:opacity-50"
          >
            취소
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={isLoading || isSaving || invalid || dirty.length === 0}
            className="flex items-center gap-1 rounded bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {isSaving ? <Spinner label="저장 중..." /> : '저장'}
          </button>
        </div>
      </div>
    </div>
  );
}
