'use client';

import { useEffect, useMemo, useState } from 'react';
import { Spinner } from '@/presentation/components/Spinner';
import { ListingRegistrationUseCase } from '@/application/usecases/ListingRegistrationUseCase';
import { ListingRegistrationRepositoryImpl } from '@/infrastructure/repositories/ListingRegistrationRepositoryImpl';
import { extractErrorMessage } from '@/infrastructure/utils/errorMessage';
import type { ListingOptionSummary } from '@/domain/entities/ListingRegistrationEntity';

interface ChannelStockModalProps {
  listingId: number;
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
 * - 비활성(43에서 체크 해제) 옵션도 행으로 보여준다. 재고는 활성 여부와 무관한 값이고,
 *   다시 활성화할 때 재고가 비어 있으면 안 된다.
 */
export function ChannelStockModal({ listingId, onSaved, onClose }: ChannelStockModalProps) {
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

  useEffect(() => {
    let alive = true;
    (async () => {
      setIsLoading(true);
      setError('');
      try {
        const res = await useCase.getListingOptions(listingId);
        if (!alive) return;
        setRows(res.options);
        setDraft(
          Object.fromEntries(res.options.map((o) => [o.optionId, o.stockQuantity ?? ''])),
        );
      } catch {
        if (alive) setError('옵션 재고를 불러오지 못했습니다.');
      } finally {
        if (alive) setIsLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [useCase, listingId]);

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
        setRows(res.options);
        setDraft(
          Object.fromEntries(res.options.map((o) => [o.optionId, o.stockQuantity ?? ''])),
        );
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
          <h2 className="text-lg font-semibold text-gray-900">채널별 재고 설정</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-sm text-gray-500 hover:text-gray-800"
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
          <p className="text-sm text-gray-500">이 채널에 옵션이 없습니다.</p>
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
                      <span className="flex-1 truncate text-sm text-gray-900">
                        {r.optionName}
                        {!r.active && (
                          <span className="ml-2 rounded bg-gray-100 px-1.5 py-0.5 text-[11px] font-medium text-gray-500">
                            비활성
                          </span>
                        )}
                        {value === '' ? (
                          <span className="ml-2 rounded bg-blue-50 px-1.5 py-0.5 text-[11px] font-medium text-blue-700">
                            상속
                          </span>
                        ) : (
                          Number(value) === 0 && (
                            <span className="ml-2 rounded bg-red-50 px-1.5 py-0.5 text-[11px] font-medium text-red-700">
                              품절
                            </span>
                          )
                        )}
                      </span>
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
