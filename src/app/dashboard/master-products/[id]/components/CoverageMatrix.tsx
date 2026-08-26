'use client';

import { Fragment, useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { PageContainer } from '@/presentation/components/PageContainer';
import { Spinner } from '@/presentation/components/Spinner';
import { useAuthStore } from '@/infrastructure/stores/authStore';
import { ROUTES } from '@/config/routes';
import { MasterProductUseCase } from '@/application/usecases/MasterProductUseCase';
import { MasterProductRepositoryImpl } from '@/infrastructure/repositories/MasterProductRepositoryImpl';
import { ListingRegistrationUseCase } from '@/application/usecases/ListingRegistrationUseCase';
import { ListingRegistrationRepositoryImpl } from '@/infrastructure/repositories/ListingRegistrationRepositoryImpl';
import type { ListingMatrixResponse, MasterOptionResponse } from '@/domain/entities/MasterProductEntity';
import type { ListingStatus, GeneratedProductResponse } from '@/domain/entities/ListingRegistrationEntity';
import { resolveThumbUrl } from '@/infrastructure/utils/thumbUrl';
import {
  DetailHtmlThumb,
  ChannelPreviewModal,
  type ChannelPreviewData,
} from '@/presentation/components/DetailHtmlPreview';
import { MasterTagsPanel } from './MasterTagsPanel';
import { CellActions } from './CellActions';
import { DisplayNameRow } from './DisplayNameRow';

interface CoverageMatrixProps {
  id: string;
}

const formatWon = (v: number) => `${v.toLocaleString('ko-KR')}원`;

/**
 * 마스터 상세 = 채널 체크목록(계정 × 리스팅) + 미등록 일괄/행별 등록 + 전파 배선.
 * File: src/app/dashboard/master-products/[id]/components/CoverageMatrix.tsx
 *
 * 채널(판매자×플랫폼)은 판매채널 관리 화면에서 정의됨 → 여기선 다시 선택하지 않는다.
 * 매트릭스 행이 곧 테넌트 전 채널 목록(registered 플래그). 미등록 행을 체크해 일괄 등록하거나
 * 행별 [등록] 원클릭으로 등록한다. 옵션은 15에서 전체 복사되므로 옵션 선택 UI 없음.
 */
export function CoverageMatrix({ id }: CoverageMatrixProps) {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const isAdmin = user?.role === 'ADMIN';
  const masterId = Number(id);

  const masterUseCase = useMemo(
    () => new MasterProductUseCase(new MasterProductRepositoryImpl()),
    [],
  );
  const listingUseCase = useMemo(
    () => new ListingRegistrationUseCase(new ListingRegistrationRepositoryImpl()),
    [],
  );
  const [matrix, setMatrix] = useState<ListingMatrixResponse | null>(null);
  const [options, setOptions] = useState<MasterOptionResponse[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  // Read-only preview gallery: per-channel generated assets (thumbnail image +
  // detail-page HTML). undefined = still loading, null = fetch failed.
  const [generated, setGenerated] = useState<Record<number, GeneratedProductResponse | null>>({});
  const [genLoading, setGenLoading] = useState(false);
  const [preview, setPreview] = useState<ChannelPreviewData | null>(null);

  // Open the tabbed preview modal for a channel, on the given initial tab.
  const openPreview = (
    gen: GeneratedProductResponse | null,
    sellerName: string,
    platform: string,
    initialTab: 'image' | 'detail',
  ) => {
    setPreview({
      imageSrc: gen?.thumbnailUrl ? resolveThumbUrl(gen.thumbnailUrl) : null,
      html: gen?.detailHtml ?? null,
      title: `${sellerName} · ${platform}`,
      initialTab,
    });
  };

  // Selection of unregistered channels, keyed by accountId.
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [isBatchAdding, setIsBatchAdding] = useState(false);
  const [rowBusyId, setRowBusyId] = useState<number | null>(null);
  const [batchSummary, setBatchSummary] = useState<
    { text: string; tone: 'green' | 'amber'; failures: string[] } | null
  >(null);

  // Propagate (A-layer) summary banner
  const [isPropagating, setIsPropagating] = useState(false);
  const [banner, setBanner] = useState<{ text: string; tone: 'green' | 'amber' } | null>(null);

  // Per-channel option activation (43): the listing id currently saving an active-set change.
  const [optionBusyId, setOptionBusyId] = useState<number | null>(null);

  // Fetch per-channel generated assets (thumbnail + detail HTML) in one call each,
  // N calls total, without blocking the table render. Each failure is absorbed as
  // null so one bad channel never stalls the rest.
  const fetchGenerated = useCallback(
    async (m: ListingMatrixResponse) => {
      const registered = m.rows.filter((r) => r.cell).map((r) => r.cell!.productListingId);
      setGenLoading(true);
      const entries = await Promise.all(
        registered.map(async (lid) => {
          try {
            return [lid, await listingUseCase.getGenerated(lid)] as const;
          } catch {
            return [lid, null] as const;
          }
        }),
      );
      setGenerated(Object.fromEntries(entries));
      setGenLoading(false);
    },
    [listingUseCase],
  );

  const load = useCallback(async () => {
    setIsLoading(true);
    setError('');
    try {
      const [m, master] = await Promise.all([
        masterUseCase.getMatrix(masterId),
        masterUseCase.getById(masterId),
      ]);
      setMatrix(m);
      setOptions(master.options);
      setSelected(new Set());
      void fetchGenerated(m); // fire-and-forget; table draws immediately, previews fill in after
    } catch {
      setError('커버리지 매트릭스를 불러오지 못했습니다.');
    } finally {
      setIsLoading(false);
    }
  }, [masterUseCase, masterId, fetchGenerated]);

  useEffect(() => {
    void (async () => {
      await load();
    })();
  }, [load]);

  const unregisteredRows = useMemo(
    () => matrix?.rows.filter((r) => !r.registered) ?? [],
    [matrix],
  );
  const allSelected = unregisteredRows.length > 0 && selected.size === unregisteredRows.length;

  const toggleOne = (accountId: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(accountId)) next.delete(accountId);
      else next.add(accountId);
      return next;
    });
  };

  const toggleAll = () => {
    setSelected(allSelected ? new Set() : new Set(unregisteredRows.map((r) => r.accountId)));
  };

  const handleBatchAdd = async () => {
    if (selected.size === 0) return;
    const targets = unregisteredRows
      .filter((r) => selected.has(r.accountId))
      .map((r) => ({ sellerId: r.sellerId, platform: r.platform }));
    setIsBatchAdding(true);
    setBatchSummary(null);
    setError('');
    try {
      const res = await listingUseCase.addChannelsBatch(masterId, { targets });
      const failures = res.results
        .filter((r) => !r.success)
        .map((r) => {
          const name = matrix?.rows.find(
            (row) => row.sellerId === r.sellerId && row.platform === r.platform,
          )?.sellerName;
          return `${name ?? r.sellerId}/${r.platform} — ${r.errorMessage ?? '실패'}`;
        });
      setBatchSummary({
        text: `요청 ${res.requested} · 등록 ${res.succeeded} · 실패 ${res.failed}`,
        tone: res.failed > 0 ? 'amber' : 'green',
        failures,
      });
      await load();
    } catch {
      setError('일괄 등록에 실패했습니다.');
    } finally {
      setIsBatchAdding(false);
    }
  };

  const handleRowAdd = async (accountId: number, sellerId: number, platform: string) => {
    setRowBusyId(accountId);
    setError('');
    try {
      await listingUseCase.addChannel(masterId, { sellerId, platform });
      await load();
    } catch (e: unknown) {
      const err = e as { response?: { status?: number; data?: { message?: string } } };
      if (err?.response?.status === 400) {
        setError(
          '표준 카테고리가 마스터에 설정되지 않았거나 이 플랫폼 매핑이 없습니다. 위 ‘표준 카테고리’에서 먼저 지정하세요.'
            + (err.response.data?.message ? ` (${err.response.data.message})` : ''),
        );
      } else {
        setError('채널 등록에 실패했습니다.');
      }
    } finally {
      setRowBusyId(null);
    }
  };

  const handlePropagate = async () => {
    if (!window.confirm('마스터 변경분을 연결된 채널에 재생성합니다')) return;
    setIsPropagating(true);
    setBanner(null);
    try {
      const res = await listingUseCase.propagate(masterId);
      setBanner({
        text: `전파됨 ${res.propagated} · 건너뜀 ${res.skipped} · 실패 ${res.failed} — 마켓 반영은 반영/승인 콘솔에서 진행하세요.`,
        tone: res.failed > 0 ? 'amber' : 'green',
      });
      await load();
    } catch {
      setBanner({ text: '전파에 실패했습니다.', tone: 'amber' });
    } finally {
      setIsPropagating(false);
    }
  };

  // Toggle one option's per-channel active flag inline (43). Sends the full active set (backend
  // requires ≥1 active). On success we patch just this cell's optionPrices in place — no full
  // reload — so the row doesn't flash. needsResync (already-pushed cell) shows the re-register hint.
  const handleToggleOption = async (listingId: number, optionId: number) => {
    const prices = generated[listingId]?.optionPrices ?? [];
    const currentActive = prices.filter((p) => p.active !== false).map((p) => p.optionId);
    const isActive = currentActive.includes(optionId);
    if (isActive && currentActive.length === 1) {
      setError('최소 1개 옵션은 활성 상태여야 합니다.');
      return;
    }
    const nextActive = isActive
      ? currentActive.filter((id) => id !== optionId)
      : [...currentActive, optionId];
    setOptionBusyId(listingId);
    setError('');
    try {
      const res = await listingUseCase.setActiveOptions(listingId, { activeOptionIds: nextActive });
      const activeById = new Map(res.options.map((o) => [o.optionId, o.active]));
      setGenerated((prev) => {
        const gen = prev[listingId];
        if (!gen) return prev;
        return {
          ...prev,
          [listingId]: {
            ...gen,
            optionPrices: gen.optionPrices.map((p) => ({
              ...p,
              active: activeById.get(p.optionId) ?? p.active,
            })),
          },
        };
      });
      if (res.needsResync) {
        setBanner({
          text: '활성 옵션이 변경되었습니다. 마켓에 반영하려면 해당 채널의 [재생성]/[마켓 등록]으로 재등록하세요.',
          tone: 'amber',
        });
      }
    } catch {
      setError('옵션 활성 상태 변경에 실패했습니다.');
    } finally {
      setOptionBusyId(null);
    }
  };

  // Matrix cell can't distinguish SUBMITTED/SELLING; map registered+platformProductId
  // to an initial status. CellActions upgrades it after a fetch-status refresh.
  const initialStatus = (platformProductId: string | null): ListingStatus =>
    platformProductId ? 'SUBMITTED' : 'DRAFT';

  const busy = isBatchAdding || rowBusyId !== null;

  return (
    <PageContainer>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => router.push(ROUTES.MASTER_PRODUCTS)}
            className="rounded border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-100"
          >
            ← 목록
          </button>
          <h1 className="text-xl font-semibold text-gray-900">
            {matrix ? matrix.masterName : '커버리지 매트릭스'}
          </h1>
        </div>
        {isAdmin && (
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleBatchAdd}
              disabled={selected.size === 0 || busy}
              className="flex items-center gap-1 rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {isBatchAdding ? (
                <Spinner label="등록 중..." />
              ) : (
                `선택 채널 일괄 등록${selected.size > 0 ? ` (${selected.size})` : ''}`
              )}
            </button>
            <button
              type="button"
              onClick={handlePropagate}
              disabled={isPropagating}
              className="flex items-center gap-1 rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-100 disabled:opacity-50"
            >
              {isPropagating ? <Spinner label="반영 중..." /> : '일괄 반영'}
            </button>
          </div>
        )}
      </div>

      {batchSummary && (
        <div
          className={`rounded px-3 py-2 text-sm ${
            batchSummary.tone === 'green' ? 'bg-green-50 text-green-700' : 'bg-amber-50 text-amber-700'
          }`}
        >
          <p>{batchSummary.text}</p>
          {batchSummary.failures.length > 0 && (
            <ul className="mt-1 list-disc pl-5 text-xs">
              {batchSummary.failures.map((f, i) => (
                <li key={i}>{f}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      {banner && (
        <p
          className={`rounded px-3 py-2 text-sm ${
            banner.tone === 'green' ? 'bg-green-50 text-green-700' : 'bg-amber-50 text-amber-700'
          }`}
        >
          {banner.text}
        </p>
      )}

      {error && <p className="rounded bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      {isAdmin && <MasterTagsPanel masterId={masterId} useCase={masterUseCase} />}

      <div className="rounded-lg bg-white shadow list-table-scroll">
        {isLoading ? (
          <div className="flex min-h-32 items-center justify-center">
            <Spinner size={24} label="불러오는 중..." />
          </div>
        ) : !matrix || matrix.rows.length === 0 ? (
          <p className="px-4 py-6 text-center text-sm text-gray-500">
            등록된 판매채널 계정이 없습니다.
          </p>
        ) : (
          <table>
            <thead>
              <tr className="border-b border-gray-200 text-left text-sm text-gray-600">
                <th className="px-4 py-3">
                  {isAdmin && unregisteredRows.length > 0 ? (
                    <label className="flex items-center gap-1 text-xs font-normal">
                      <input
                        type="checkbox"
                        checked={allSelected}
                        onChange={toggleAll}
                        disabled={busy}
                      />
                      미등록 전체
                    </label>
                  ) : null}
                </th>
                <th className="px-4 py-3">썸네일</th>
                <th className="px-4 py-3">상세페이지</th>
                <th className="px-4 py-3">판매자</th>
                <th className="px-4 py-3">플랫폼</th>
                <th className="px-4 py-3">계정</th>
                <th className="px-4 py-3">상태</th>
                <th className="px-4 py-3">판매가</th>
                <th className="px-4 py-3">액션</th>
              </tr>
            </thead>
            <tbody>
              {matrix.rows.map((row) => {
                const badge = !row.registered
                  ? '미등록'
                  : row.cell?.platformProductId
                    ? '등록됨'
                    : 'DRAFT';
                return (
                  <Fragment key={row.accountId}>
                  <tr
                    className="border-b border-gray-100 text-sm text-gray-900"
                  >
                    <td className="px-4 py-3">
                      {isAdmin && !row.registered ? (
                        <input
                          type="checkbox"
                          checked={selected.has(row.accountId)}
                          onChange={() => toggleOne(row.accountId)}
                          disabled={busy}
                        />
                      ) : null}
                    </td>
                    <td className="px-4 py-3 align-top">
                      {(() => {
                        if (!row.cell) return <span className="text-gray-400">–</span>;
                        const gen = generated[row.cell.productListingId];
                        if (gen === undefined) {
                          return genLoading ? (
                            <Spinner size={14} />
                          ) : (
                            <span className="text-gray-400">–</span>
                          );
                        }
                        const url = gen?.thumbnailUrl;
                        if (!url) return <span className="text-gray-400">–</span>;
                        const resolved = resolveThumbUrl(url);
                        return (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={resolved}
                            alt={`${row.sellerName} 썸네일`}
                            onClick={() => openPreview(gen, row.sellerName, row.platform, 'image')}
                            className="h-24 w-24 cursor-pointer rounded border border-gray-200 object-contain hover:opacity-80"
                          />
                        );
                      })()}
                    </td>
                    <td className="px-4 py-3 align-top">
                      {(() => {
                        if (!row.cell) return <span className="text-gray-400">–</span>;
                        const gen = generated[row.cell.productListingId];
                        if (gen === undefined) {
                          return genLoading ? (
                            <Spinner size={14} />
                          ) : (
                            <span className="text-gray-400">–</span>
                          );
                        }
                        const html = gen?.detailHtml;
                        if (!html) return <span className="text-xs text-gray-400">미생성</span>;
                        return (
                          <DetailHtmlThumb
                            html={html}
                            width={96}
                            height={96}
                            onClick={() => openPreview(gen, row.sellerName, row.platform, 'detail')}
                          />
                        );
                      })()}
                    </td>
                    <td className="px-4 py-3">{row.sellerName}</td>
                    <td className="px-4 py-3">{row.platform}</td>
                    <td className="px-4 py-3">{row.accountLabel}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded px-1.5 py-0.5 text-[10px] ${
                          !row.registered
                            ? 'bg-gray-100 text-gray-500'
                            : row.cell?.platformProductId
                              ? 'bg-green-100 text-green-700'
                              : 'bg-amber-100 text-amber-700'
                        }`}
                      >
                        {badge}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {(() => {
                        if (!row.cell) return <span className="text-gray-400">–</span>;
                        // Prefer per-option prices (a master can have many options with
                        // distinct prices); fall back to the single representative price.
                        const prices = generated[row.cell.productListingId]?.optionPrices ?? [];
                        if (prices.length === 0) {
                          return row.cell.sellingPrice != null ? (
                            formatWon(row.cell.sellingPrice)
                          ) : (
                            <span className="text-gray-400">–</span>
                          );
                        }
                        // Inline per-option active toggle (43): checkbox = market inclusion, unchecked =
                        // greyed. Non-admins see a plain read-only list (no checkbox).
                        const listingId = row.cell.productListingId;
                        return (
                          <div className="space-y-0.5">
                            {prices.map((p) => {
                              const active = p.active !== false;
                              // Prefer the name the backend sends with each price. Fall back to the
                              // master option lookup (legacy responses), then the raw id.
                              const name = p.optionName
                                ?? options.find((o) => o.id === p.optionId)?.name
                                ?? `옵션 #${p.optionId}`;
                              const label = (
                                <span className={active ? '' : 'text-gray-400'}>
                                  <span className={active ? 'text-gray-500' : ''}>{name}: </span>
                                  {formatWon(p.sellingPrice)}
                                </span>
                              );
                              return isAdmin ? (
                                <label
                                  key={p.optionId}
                                  className="flex items-center gap-1.5 whitespace-nowrap text-xs"
                                >
                                  <input
                                    type="checkbox"
                                    checked={active}
                                    disabled={optionBusyId === listingId}
                                    onChange={() => handleToggleOption(listingId, p.optionId)}
                                  />
                                  {label}
                                </label>
                              ) : (
                                <div key={p.optionId} className="whitespace-nowrap text-xs">
                                  {label}
                                </div>
                              );
                            })}
                          </div>
                        );
                      })()}
                    </td>
                    <td className="px-4 py-3">
                      {!isAdmin ? (
                        <span className="text-xs text-gray-400">–</span>
                      ) : !row.registered || !row.cell ? (
                        <button
                          type="button"
                          onClick={() =>
                            handleRowAdd(row.accountId, row.sellerId, row.platform)
                          }
                          disabled={busy}
                          className="flex items-center gap-1 rounded border border-blue-300 px-2 py-1 text-xs font-medium text-blue-700 hover:bg-blue-50 disabled:opacity-50"
                        >
                          {rowBusyId === row.accountId ? <Spinner size={12} label="등록 중" /> : '등록'}
                        </button>
                      ) : (
                        <CellActions
                          masterId={masterId}
                          listing={{
                            id: row.cell.productListingId,
                            status: initialStatus(row.cell.platformProductId),
                          }}
                          options={options}
                          onReload={load}
                        />
                      )}
                    </td>
                  </tr>
                  {isAdmin && row.registered && row.cell && (
                    <DisplayNameRow
                      listingId={row.cell.productListingId}
                      name={row.cell.name}
                      tags={generated[row.cell.productListingId]?.tags ?? []}
                      onSaved={load}
                    />
                  )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      <ChannelPreviewModal data={preview} onClose={() => setPreview(null)} />
    </PageContainer>
  );
}
