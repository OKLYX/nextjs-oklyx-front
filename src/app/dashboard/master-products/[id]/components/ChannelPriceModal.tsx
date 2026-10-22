'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Spinner } from '@/presentation/components/Spinner';
import { ListingRegistrationUseCase } from '@/application/usecases/ListingRegistrationUseCase';
import { ListingRegistrationRepositoryImpl } from '@/infrastructure/repositories/ListingRegistrationRepositoryImpl';
import { extractErrorMessage } from '@/infrastructure/utils/errorMessage';
import type {
  ListingOptionSummary,
  ChannelPriceUpdateResponse,
} from '@/domain/entities/ListingRegistrationEntity';
import { Button } from '@/presentation/components/ui/Button';
import { Modal } from '@/presentation/components/ui/Modal';
import { MarginPreviewText } from './ListingMargin';

interface ChannelPriceModalProps {
  listingId: number;
  // "판매자명 · 플랫폼" — which cell is being edited (the matrix has many).
  channelLabel: string;
  onSaved: () => void;
  onClose: () => void;
}

/**
 * Per-channel (cell) option selling price editor (2609_19).
 * File: src/app/dashboard/master-products/[id]/components/ChannelPriceModal.tsx
 *
 * A selling price is the margin back-calculated price by default; this modal overrides it for **this channel only**.
 * - Each input is pre-filled with the current value. Emptying it locks the save button (no trip to a 400) —
 *   to go back to the calculated price, press [기본값으로 변경].
 * - [기본값으로 변경] = that field is sent as `null` → the server recalculates it back to the automatic price (D3).
 * - Saving **also pushes to the market** (D4); the result (pushed / skipped / failed) is shown inside the modal.
 * - Inactive options are hidden (same rule as the stock modal, D10). Their values stay on the server.
 * - FEATURE_2610_27 / D6 · D20 · D21 · D38: next to each input, the margin of the typed price (`MarginPreviewText`, asked
 *   300 ms after typing stops) — red when under the margin preset minimum. It never blocks a save: the margin policy
 *   is an input of the price calculation (2609_19 D9).
 * - FEATURE_2610_26 / D53 ②: a Gmarket · Auction (ESM) option (`auctionSellingPrice != null`) has two fields, 「G마켓」 and
 *   「옥션」, each with its own [기본값으로 변경]. An untouched field is sent as its current value when it was set by hand
 *   and as `null` when it is automatic, so saving one site never changes the other site's origin.
 */
export function ChannelPriceModal({
  listingId,
  channelLabel,
  onSaved,
  onClose,
}: ChannelPriceModalProps) {
  const useCase = useMemo(
    () => new ListingRegistrationUseCase(new ListingRegistrationRepositoryImpl()),
    [],
  );

  const [rows, setRows] = useState<ListingOptionSummary[]>([]);
  // 행별 입력 버퍼. 문자열로 들고 있다가 저장 시 한 번만 Number 로 바꾼다
  // (입력 중 Number 변환은 "1000" 앞의 0 이나 빈칸을 0 으로 뭉갠다).
  const [draft, setDraft] = useState<Record<number, string>>({});
  // [기본값으로 변경] 을 누른 행. 저장 시 sellingPrice: null 로 나간다(D3).
  const [restore, setRestore] = useState<Set<number>>(new Set());
  // FEATURE_2610_26 / D53 ②: the Auction field of an ESM option — its own input buffer and its own [기본값으로 변경].
  const [draftAuction, setDraftAuction] = useState<Record<number, string>>({});
  const [restoreAuction, setRestoreAuction] = useState<Set<number>>(new Set());
  const [result, setResult] = useState<ChannelPriceUpdateResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');

  // 서버 응답 → 화면 재시드. 저장 직후에도 같은 함수를 쓴다(부분 성공 시 값이 섞이지 않게).
  // `keep` = 마켓 실패로 **저장되지 않은** 행(D6). 그 행만 입력 버퍼와 restore 상태를 그대로 둔다.
  const applyOptions = useCallback(
    (options: ListingOptionSummary[], keep: Set<number> = new Set()) => {
      const visible = options.filter((o) => o.active);
      setRows(visible);
      setDraft((prev) =>
        Object.fromEntries(
          visible.map((o) => [
            o.optionId,
            keep.has(o.optionId)
              ? (prev[o.optionId] ?? String(o.sellingPrice))
              : String(o.sellingPrice),
          ]),
        ),
      );
      setRestore((prev) => new Set([...prev].filter((id) => keep.has(id))));
      setDraftAuction((prev) =>
        Object.fromEntries(
          visible
            .filter((o) => o.auctionSellingPrice != null)
            .map((o) => [
              o.optionId,
              keep.has(o.optionId)
                ? (prev[o.optionId] ?? String(o.auctionSellingPrice))
                : String(o.auctionSellingPrice),
            ]),
        ),
      );
      setRestoreAuction((prev) => new Set([...prev].filter((id) => keep.has(id))));
    },
    [],
  );

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
        if (alive) setError('옵션 판매가를 불러오지 못했습니다.');
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
  const parsed = (id: number) => Number(raw(id));
  // 원 단위 정수만 허용한다 — 백엔드가 저장·전송 직전에 원 단위로 정규화하므로(D13),
  // 소수점을 통과시키면 사용자가 입력한 값과 저장된 값이 달라진다.
  const validRow = (id: number) => {
    const v = parsed(id);
    return raw(id).trim() !== '' && Number.isInteger(v) && v >= 10;
  };
  // FEATURE_2610_26 / D53 ②: the same three helpers for the Auction field of an ESM option.
  const rawAuction = (id: number) => draftAuction[id] ?? '';
  const parsedAuction = (id: number) => Number(rawAuction(id));
  const validAuction = (id: number) => {
    const v = parsedAuction(id);
    return rawAuction(id).trim() !== '' && Number.isInteger(v) && v >= 10;
  };
  const isEsmRow = (r: ListingOptionSummary) => r.auctionSellingPrice != null;
  const auctionTouched = (r: ListingOptionSummary) =>
    isEsmRow(r) && (restoreAuction.has(r.optionId) || parsedAuction(r.optionId) !== r.auctionSellingPrice);
  const sellingTouched = (r: ListingOptionSummary) =>
    restore.has(r.optionId) || parsed(r.optionId) !== r.sellingPrice;
  const invalid = rows.some(
    (r) =>
      (!restore.has(r.optionId) && !validRow(r.optionId)) ||
      (isEsmRow(r) && !restoreAuction.has(r.optionId) && !validAuction(r.optionId)),
  );
  const dirty = rows.filter((r) => sellingTouched(r) || auctionTouched(r));

  const toggleRestore = (optionId: number) =>
    setRestore((prev) => {
      const next = new Set(prev);
      if (next.has(optionId)) next.delete(optionId);
      else next.add(optionId);
      return next;
    });
  const toggleRestoreAuction = (optionId: number) =>
    setRestoreAuction((prev) => {
      const next = new Set(prev);
      if (next.has(optionId)) next.delete(optionId);
      else next.add(optionId);
      return next;
    });

  const handleSave = async () => {
    if (dirty.length === 0) {
      onClose();
      return;
    }
    setIsSaving(true);
    setError('');
    setResult(null); // 이전 부분 성공 배너를 지운다 — 남으면 옛 실패가 새 결과처럼 읽힌다
    try {
      const res = await useCase.setOptionPrices(listingId, {
        prices: dirty.map((r) =>
          isEsmRow(r)
            ? {
                // D53 ②: an untouched site keeps its origin — its value when set by hand, null when automatic.
                optionId: r.optionId,
                sellingPrice:
                  restore.has(r.optionId) ||
                  (!sellingTouched(r) && r.priceSource !== 'MANUAL_OVERRIDE')
                    ? null
                    : parsed(r.optionId),
                auctionSellingPrice:
                  restoreAuction.has(r.optionId) ||
                  (!auctionTouched(r) && r.auctionPriceSource !== 'MANUAL_OVERRIDE')
                    ? null
                    : parsedAuction(r.optionId),
              }
            : {
                optionId: r.optionId,
                sellingPrice: restore.has(r.optionId) ? null : parsed(r.optionId),
              },
        ),
      });
      // 실패 행 식별자는 옵션명뿐이다(백엔드 `FailedOption.optionName`) → 현재 rows 에서 id 로 되돌린다.
      const failedIds = new Set(
        rows
          .filter((r) => res.failed.some((f) => f.optionName === r.optionName))
          .map((r) => r.optionId),
      );
      applyOptions(res.listing.options, failedIds);
      setResult(res);
      onSaved(); // 매트릭스는 어느 경우에도 갱신한다
      if (res.failed.length === 0 && res.skipped.length === 0) onClose();
    } catch (e: unknown) {
      // 백엔드 400 문구(리스팅 옵션 아님·마진 프리셋 없음 등)를 그대로 노출한다.
      setError(extractErrorMessage(e, '판매가 저장에 실패했습니다.'));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Modal
      isOpen
      onClose={onClose}
      title="채널별 판매가"
    >
      <p className="truncate text-xs text-gray-500">{channelLabel}</p>

      {error && <p className="mb-4 rounded bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      {result && (
        <div className="mb-4 space-y-1">
          {result.pushed > 0 && (
            <p className="rounded bg-green-50 px-3 py-2 text-sm text-green-700">
              마켓에 {result.pushed}건 반영했습니다.
            </p>
          )}
          {result.skipped.length > 0 && (
            <p className="rounded bg-gray-50 px-3 py-2 text-sm text-gray-600">
              아직 마켓에 없는 옵션은 저장만 했습니다: {result.skipped.join(', ')}. [마켓에 올리기] 시
              이 가격으로 올라갑니다.
            </p>
          )}
          {result.failed.map((f) => (
            <p
              key={f.optionName}
              className="rounded bg-red-50 px-3 py-2 text-sm text-red-700"
            >
              마켓 반영 실패(저장되지 않음): {f.optionName} — {f.message}
            </p>
          ))}
        </div>
      )}

      {isLoading ? (
        <div className="flex min-h-32 items-center justify-center">
          <Spinner size={24} label="불러오는 중..." />
        </div>
      ) : rows.length === 0 ? (
        <p className="text-sm text-gray-500">이 채널에서 판매 중인 옵션이 없습니다.</p>
      ) : (
        <>
          <p className="mb-3 text-[11px] text-gray-500">
            입력한 가격은 이 채널에만 적용됩니다. 자동계산가로 되돌리려면 [기본값으로 변경]을
            누르세요.
          </p>
          <ul className="max-h-80 space-y-2 overflow-y-auto">
            {rows.map((r) => {
              const willRestore = restore.has(r.optionId);
              const value = raw(r.optionId);
              const empty = !willRestore && value.trim() === '';
              if (isEsmRow(r)) {
                // FEATURE_2610_26 / D53 ②: 「G마켓」 and 「옥션」, each field with its own [기본값으로 변경].
                const auctionRestore = restoreAuction.has(r.optionId);
                const auctionValue = rawAuction(r.optionId);
                const auctionEmpty = !auctionRestore && auctionValue.trim() === '';
                const sites = [
                  {
                    label: 'G마켓',
                    manual: r.priceSource === 'MANUAL_OVERRIDE',
                    restoring: willRestore,
                    value,
                    empty,
                    auction: false,
                    price: !willRestore && validRow(r.optionId) ? parsed(r.optionId) : null,
                    onChange: (v: string) => setDraft((prev) => ({ ...prev, [r.optionId]: v })),
                    onRestore: () => toggleRestore(r.optionId),
                  },
                  {
                    label: '옥션',
                    manual: r.auctionPriceSource === 'MANUAL_OVERRIDE',
                    restoring: auctionRestore,
                    value: auctionValue,
                    empty: auctionEmpty,
                    auction: true,
                    price: !auctionRestore && validAuction(r.optionId) ? parsedAuction(r.optionId) : null,
                    onChange: (v: string) => setDraftAuction((prev) => ({ ...prev, [r.optionId]: v })),
                    onRestore: () => toggleRestoreAuction(r.optionId),
                  },
                ];
                return (
                  <li key={r.optionId} className="rounded border border-gray-200 px-3 py-2">
                    <p className="mb-1 truncate text-sm text-gray-900">{r.optionName}</p>
                    {sites.map((site) => (
                      <div key={site.label} className="mt-1">
                        <div className="flex items-center gap-2">
                          <span className="flex min-w-0 flex-1 items-center gap-1">
                            <span className="text-xs text-gray-600">{site.label}</span>
                            {site.manual && (
                              <span className="shrink-0 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] text-amber-700">
                                수동
                              </span>
                            )}
                          </span>
                          <div className="flex shrink-0 items-center gap-1">
                            <input
                              type="text"
                              inputMode="numeric"
                              aria-label={`${r.optionName} ${site.label} 판매가`}
                              disabled={site.restoring || isSaving}
                              className="w-28 rounded border border-gray-300 px-2 py-1 text-right text-sm text-gray-900 disabled:bg-gray-100 disabled:text-gray-400"
                              value={site.value}
                              onChange={(e) => site.onChange(e.target.value)}
                            />
                            <span className="text-xs text-gray-500">원</span>
                          </div>
                          <span className="w-32 shrink-0 text-right text-[11px]">
                            <MarginPreviewText
                              listingId={listingId}
                              optionId={r.optionId}
                              auction={site.auction}
                              price={site.price}
                            />
                          </span>
                          <button
                            type="button"
                            onClick={site.onRestore}
                            disabled={isSaving}
                            className={`shrink-0 rounded border px-2 py-1 text-[11px] font-medium disabled:opacity-50 ${
                              site.restoring
                                ? 'border-blue-300 bg-blue-50 text-blue-700 hover:bg-blue-100'
                                : 'border-gray-300 text-gray-700 hover:bg-gray-100'
                            }`}
                          >
                            기본값으로 변경
                          </button>
                        </div>
                        {site.restoring && (
                          <p className="mt-1 text-[11px] text-gray-500">
                            저장하면 자동계산가로 돌아갑니다
                          </p>
                        )}
                        {site.empty && (
                          <p className="mt-1 text-[11px] text-gray-500">
                            값을 입력하거나 [기본값으로 변경]을 누르세요
                          </p>
                        )}
                      </div>
                    ))}
                  </li>
                );
              }
              return (
                <li key={r.optionId} className="rounded border border-gray-200 px-3 py-2">
                  <div className="flex items-center gap-2">
                    {/* min-w-0 so a long option name truncates instead of squeezing the input. */}
                    <span className="flex min-w-0 flex-1 items-center gap-1">
                      <span className="truncate text-sm text-gray-900">{r.optionName}</span>
                      {r.priceSource === 'MANUAL_OVERRIDE' && (
                        <span className="shrink-0 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] text-amber-700">
                          수동
                        </span>
                      )}
                    </span>
                    <div className="flex shrink-0 items-center gap-1">
                      <input
                        type="text"
                        inputMode="numeric"
                        disabled={willRestore || isSaving}
                        className="w-28 rounded border border-gray-300 px-2 py-1 text-right text-sm text-gray-900 disabled:bg-gray-100 disabled:text-gray-400"
                        value={value}
                        onChange={(e) =>
                          setDraft((prev) => ({ ...prev, [r.optionId]: e.target.value }))
                        }
                      />
                      <span className="text-xs text-gray-500">원</span>
                    </div>
                    <span className="w-32 shrink-0 text-right text-[11px]">
                      <MarginPreviewText
                        listingId={listingId}
                        optionId={r.optionId}
                        auction={false}
                        price={!willRestore && validRow(r.optionId) ? parsed(r.optionId) : null}
                      />
                    </span>
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
                  </div>
                  {willRestore && (
                    <p className="mt-1 text-[11px] text-gray-500">
                      저장하면 자동계산가로 돌아갑니다
                    </p>
                  )}
                  {empty && (
                    <p className="mt-1 text-[11px] text-gray-500">
                      값을 입력하거나 [기본값으로 변경]을 누르세요
                    </p>
                  )}
                </li>
              );
            })}
          </ul>
        </>
      )}

      <div className="mt-5 flex flex-col items-end gap-1">
        <div className="flex justify-end gap-2">
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
        {isSaving && (
          <p className="text-[11px] text-gray-500">
            마켓에 반영하는 중이라 몇 초 걸릴 수 있습니다.
          </p>
        )}
      </div>
    </Modal>
  );
}
