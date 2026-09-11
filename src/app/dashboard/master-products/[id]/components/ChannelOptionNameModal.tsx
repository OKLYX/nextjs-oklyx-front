'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Spinner } from '@/presentation/components/Spinner';
import { ListingRegistrationUseCase } from '@/application/usecases/ListingRegistrationUseCase';
import { ListingRegistrationRepositoryImpl } from '@/infrastructure/repositories/ListingRegistrationRepositoryImpl';
import { extractErrorMessage } from '@/infrastructure/utils/errorMessage';
import type { ListingOptionSummary } from '@/domain/entities/ListingRegistrationEntity';
import { Button } from '@/presentation/components/ui/Button';

interface ChannelOptionNameModalProps {
  listingId: number;
  // "판매자명 · 플랫폼" — 어느 셀을 편집 중인지(매트릭스에는 셀이 여럿이다).
  channelLabel: string;
  onSaved: () => void;
  onClose: () => void;
}

/**
 * 채널(셀)별 옵션명 편집 모달 (2609_22/D3).
 * File: src/app/dashboard/master-products/[id]/components/ChannelOptionNameModal.tsx
 *
 * 옵션명은 기본적으로 마스터 옵션명을 따르고, 이 모달은 **그 채널만** 다른 이름으로 부른다
 * (쿠팡에서 가져온 상품은 마켓이 이미 그 이름을 보여주고 있다).
 * - [기본값으로 변경] = 그 행을 `null` 로 전송 → 서버가 마스터 옵션명으로 되돌린다.
 * - ⚠️ 채널 전용 옵션에는 [기본값으로 변경]을 렌더하지 않는다(되돌릴 마스터 이름이 없다 — 서버도 400).
 * - ⚠️ 재고 모달에 얹지 않고 별도 모달로 둔다 — "이름만 바뀌었으면 이름 API 만" 같은 분기를
 *   재고 저장 경로에 들이지 않기 위해서다.
 */
export function ChannelOptionNameModal({
  listingId,
  channelLabel,
  onSaved,
  onClose,
}: ChannelOptionNameModalProps) {
  const useCase = useMemo(
    () => new ListingRegistrationUseCase(new ListingRegistrationRepositoryImpl()),
    [],
  );

  const [rows, setRows] = useState<ListingOptionSummary[]>([]);
  // 행별 입력 버퍼(옵션명 문자열).
  const [draft, setDraft] = useState<Record<number, string>>({});
  // [기본값으로 변경] 을 누른 행. 저장 시 optionName: null 로 나간다.
  const [restore, setRestore] = useState<Set<number>>(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');

  // 서버 응답 → 화면 재시드. 저장 직후에도 같은 함수를 쓴다.
  const applyOptions = useCallback((options: ListingOptionSummary[]) => {
    setRows(options);
    setDraft(Object.fromEntries(options.map((o) => [o.optionId, o.optionName])));
    setRestore(new Set());
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
        if (alive) setError('옵션명을 불러오지 못했습니다.');
      } finally {
        if (alive) setIsLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [useCase, listingId, applyOptions]);

  // ⚠️ `draft[id]` 를 직접 쓰지 말 것 — 로드 전/재시드 직후 undefined 면 `.trim()` 이 터진다.
  const raw = (id: number) => draft[id] ?? '';

  const toggleRestore = (optionId: number) =>
    setRestore((prev) => {
      const next = new Set(prev);
      if (next.has(optionId)) next.delete(optionId);
      else next.add(optionId);
      return next;
    });

  const invalid = rows.some((r) => !restore.has(r.optionId) && raw(r.optionId).trim() === '');
  const dirty = rows.filter(
    (r) => restore.has(r.optionId) || raw(r.optionId).trim() !== r.optionName,
  );

  const handleSave = async () => {
    if (dirty.length === 0) {
      onClose();
      return;
    }
    setIsSaving(true);
    setError('');
    try {
      const res = await useCase.setOptionNames(listingId, {
        names: dirty.map((r) => ({
          optionId: r.optionId,
          optionName: restore.has(r.optionId) ? null : raw(r.optionId).trim(),
        })),
      });
      applyOptions(res.options);
      onSaved();
      onClose();
    } catch (e: unknown) {
      // 같은 셀 안에서 이름이 겹치면 서버가 400 → 문구 그대로 노출하고 폼은 유지한다.
      setError(extractErrorMessage(e, '옵션명 저장에 실패했습니다.'));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-lg rounded-lg bg-white p-5 shadow-lg">
        <div className="mb-4 flex items-center justify-between">
          <div className="min-w-0">
            <h2 className="text-lg font-semibold text-gray-900">채널별 옵션명</h2>
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

        {isLoading ? (
          <div className="flex min-h-32 items-center justify-center">
            <Spinner size={24} label="불러오는 중..." />
          </div>
        ) : rows.length === 0 ? (
          <p className="text-sm text-gray-500">이 채널에 옵션이 없습니다.</p>
        ) : (
          <>
            <p className="mb-3 text-[11px] text-gray-500">
              입력한 이름은 이 채널에만 적용됩니다. 마스터 옵션명으로 되돌리려면 [기본값으로 변경]을
              누르세요.
            </p>
            <ul className="max-h-80 space-y-2 overflow-y-auto">
              {rows.map((r) => {
                const willRestore = restore.has(r.optionId);
                const value = raw(r.optionId);
                const empty = !willRestore && value.trim() === '';
                return (
                  <li key={r.optionId} className="rounded border border-gray-200 px-3 py-2">
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        disabled={willRestore || isSaving}
                        className="min-w-0 flex-1 rounded border border-gray-300 px-2 py-1 text-sm text-gray-900 disabled:bg-gray-100 disabled:text-gray-400"
                        value={value}
                        onChange={(e) =>
                          setDraft((prev) => ({ ...prev, [r.optionId]: e.target.value }))
                        }
                      />
                      {r.channelOnly === true && (
                        <span className="shrink-0 rounded bg-gray-100 px-1.5 py-0.5 text-xs text-gray-600">
                          채널 전용
                        </span>
                      )}
                      {r.optionNameSource === 'MANUAL_OVERRIDE' && (
                        <span className="shrink-0 rounded border border-gray-300 px-1.5 py-0.5 text-xs text-gray-600">
                          이름 직접 지정
                        </span>
                      )}
                      {/* 채널 전용 옵션은 되돌릴 마스터 이름이 없다 → 버튼 자체를 렌더하지 않는다. */}
                      {r.channelOnly !== true && (
                        <button
                          type="button"
                          onClick={() => toggleRestore(r.optionId)}
                          disabled={isSaving}
                          className={`shrink-0 rounded border px-2 py-1 text-[11px] font-medium disabled:opacity-50 ${
                            willRestore
                              ? 'border-blue-300 bg-blue-50 text-blue-700 hover:bg-blue-100'
                              : 'border-gray-300 text-gray-700 hover:bg-gray-100'
                          }`}
                        >
                          기본값으로 변경
                        </button>
                      )}
                    </div>
                    {willRestore && (
                      <p className="mt-1 text-[11px] text-gray-500">
                        저장하면 마스터 옵션명으로 돌아갑니다
                      </p>
                    )}
                    {empty && (
                      <p className="mt-1 text-[11px] text-gray-500">
                        이름을 입력하거나 [기본값으로 변경]을 누르세요
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
          {rows.length > 0 && (
            <Button
              type="button"
              onClick={handleSave}
              disabled={isLoading || isSaving || invalid || dirty.length === 0}
              size="sm"
              className="flex items-center gap-1"
            >
              {isSaving ? <Spinner label="저장 중..." /> : '저장'}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
