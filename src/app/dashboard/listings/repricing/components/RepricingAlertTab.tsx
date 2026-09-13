'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Spinner } from '@/presentation/components/Spinner';
import { Card } from '@/presentation/components/ui/Card';
import { Button } from '@/presentation/components/ui/Button';
import { ConfirmDialog } from '@/presentation/components/ui/ConfirmDialog';
import { RepricingUseCase } from '@/application/usecases/RepricingUseCase';
import { RepricingRepositoryImpl } from '@/infrastructure/repositories/RepricingRepositoryImpl';
import { PLATFORMS } from '@/config/platforms';
import { extractErrorMessage } from '@/infrastructure/utils/errorMessage';
import type { Seller } from '@/domain/entities/SellerEntity';
import {
  REPRICE_PUSH_CHUNK_SIZE,
  type RepriceFailedOption,
  type RepriceSkippedOption,
  type RepricingCandidatesResponse,
  type RepricingRow,
  type RepricingScope,
} from '@/domain/entities/RepricingEntity';
import {
  RepricingGroupCard,
  type RepricingAction,
  type RepricingBanner,
} from './RepricingGroupCard';
import { formatWon } from './RepricingTable';
import {
  mergeKeptGroups,
  mergeKeptRows,
  type RecentAction,
  type RecentActionMap,
} from './rowActions';

const groupKeyOf = (sellerId: number, platform: string) => `${sellerId}::${platform}`;

/**
 * 실행 결과 안내 끝에 붙이는 한 줄(2609_43 / 03 Step 4).
 *
 * 「방금 처리함」 표시와 대체 관계가 아니다 — 그쪽은 새로고침하면 사라지는 즉시 확인용이고,
 * 이력 탭은 새로고침 후에도 남는 기록이다.
 */
const HISTORY_HINT = ' [판매가 조정 내역] 탭에서 확인할 수 있습니다.';

/** 429 쿨다운 재시도 시각. 「잠시 후」로 쓰면 사용자가 계속 누른다(PLAN 2609_39 D26 — 쿨다운 약 10분). */
const formatRetryAfter = (iso: string | null) => {
  if (!iso) return '';
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) return '';
  return at.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
};

interface PendingConfirm {
  action: Exclude<RepricingAction, 'OVERRIDE'>;
  groupKey: string;
  groupLabel: string;
  platform: string;
  listingIds: number[];
  optionIds: number[];
  /** RECALC 일 때 그 그룹에서 덮어써질 미저장 입력값 수 */
  unsavedCount: number;
  /** 행 단위 실행이면 그 행 이름. 묶음 실행이면 null */
  rowLabel: string | null;
}

interface RepricingAlertTabProps {
  sellers: Seller[];
  /** 🔴 판매자·채널은 두 탭이 함께 쓰는 값이라 페이지가 소유한다(2609_43 / 03 Step 1) */
  sellerId: number | '';
  platform: string;
  onSellerChange: (value: number | '') => void;
  onPlatformChange: (value: string) => void;
  /** 조회·실행 중 여부를 페이지에 알린다 — 탭 버튼을 잠그는 데 쓴다 */
  onBusyChange: (busy: boolean) => void;
}

/**
 * 「판매가 주의 물품」 탭 — 마진 경보 목록 + [재계산] → [마켓 반영] 2단계 실행(FEATURE_2609_39).
 * File: src/app/dashboard/listings/repricing/components/RepricingAlertTab.tsx
 *
 * 🔴 `dashboard/listings/sync` 와 **다른 화면**이다(PLAN 2609_39 D12): 저쪽은 콘텐츠 재전송(재심사),
 *    여기는 가격 전송이다. 두 기능을 한 표에 합치지 않는다.
 * 🔴 [마켓 반영]은 승인 없이 **실제 판매가를 즉시 바꾼다** — 확인 모달 없이 전송하지 않는다(D7).
 * 🔴 실행 단위가 둘이다(2609_43 D3·D8): 기본은 **행 하나**([저장]·[마켓 반영]), 묶음 버튼은 선택한 여러 건.
 *    행 단위도 **같은 엔드포인트를 1건짜리 요청으로** 부른다 — 서버에 새 경로를 만들지 않는다.
 * 🔴 저장하지 않은 입력값이 있으면 그 행의 마켓 반영을 막는다(D6). 옛 값이 조용히 나가는 사고를 막는 장치다.
 * 🔴 처리한 행은 응답에서 빠져도 화면이 기억해 그 자리에 남긴다(D7 — {@link RecentActionMap}).
 *    비우는 시점은 [새로고침]과 필터 변경 **둘뿐**이고, 시간으로 자동 삭제하지 않는다.
 * 🔴 [마켓 반영]은 한 번에 {@link REPRICE_PUSH_CHUNK_SIZE} 건씩 나눠 순차 호출한다(D26 — 서버 상한 200 의
 *    실제 소요가 미측정이라 504 구간이다). 숫자는 그 상수 한 곳에서만 고친다.
 * 자동 폴링 없음 — 모든 갱신은 수동 트리거(sync 콘솔과 같은 자세).
 */
export function RepricingAlertTab({
  sellers,
  sellerId,
  platform,
  onSellerChange,
  onPlatformChange,
  onBusyChange,
}: RepricingAlertTabProps) {
  const useCase = useMemo(() => new RepricingUseCase(new RepricingRepositoryImpl()), []);

  /** 🔴 범위는 이 탭 전용이다 — 이력 탭에는 「대응 필요」라는 개념이 없어 그쪽에서는 숨긴다 */
  const [formScope, setFormScope] = useState<RepricingScope>('BELOW');

  const [data, setData] = useState<RepricingCandidatesResponse>({ groups: [], rows: [] });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  const [selected, setSelected] = useState<number[]>([]);
  /** 편집 중인 optionId = 저장하지 않은 입력값이 있는 행(2609_43 D5·D6) */
  const [editing, setEditing] = useState<number[]>([]);
  /** optionId → 「새 판매가」 입력칸 문자열. 화면에만 있는 값이고 행 [저장] 으로만 서버에 간다 */
  const [drafts, setDrafts] = useState<Record<number, string>>({});
  const [busy, setBusy] = useState<{
    groupKey: string;
    action: RepricingAction;
    optionId: number | null;
  } | null>(null);
  const [banners, setBanners] = useState<Record<string, RepricingBanner>>({});
  const [confirm, setConfirm] = useState<PendingConfirm | null>(null);

  /**
   * 「방금 처리한 행」. 🔴 실행 직후 목록을 다시 부를 때 **읽는 쪽이 최신 값이어야** 해서 ref 가 원본이고
   * state 는 그리기용 사본이다(setState 는 다음 렌더까지 반영되지 않는다).
   */
  const recentRef = useRef<RecentActionMap>({});
  const [recent, setRecent] = useState<RecentActionMap>({});
  /** 직전 목록. 응답에서 빠진 「처리한 행」을 그 자리에 남기려면 이전 순서를 알아야 한다(D7) */
  const rowsRef = useRef<RepricingRow[]>([]);
  const groupsRef = useRef<RepricingCandidatesResponse['groups']>([]);

  const putRecent = useCallback((entries: [number, RecentAction][]) => {
    const next = { ...recentRef.current };
    for (const [optionId, action] of entries) next[optionId] = action;
    recentRef.current = next;
    setRecent(next);
  }, []);

  /** 처리 표시를 비운다 — [새로고침]과 필터 변경에서만 부른다(D7). */
  const clearRecent = useCallback(() => {
    recentRef.current = {};
    setRecent({});
  }, []);

  const load = useCallback(
    async (params: { sellerId: number | ''; platform: string; scope: RepricingScope }) => {
      setIsLoading(true);
      setError('');
      try {
        const res = await useCase.candidates({
          sellerId: params.sellerId === '' ? undefined : params.sellerId,
          platform: params.platform || undefined,
          scope: params.scope,
        });
        // 🔴 응답에서 빠진 행이라도 방금 처리한 행이면 그 자리에 남긴다(D7).
        const rows = mergeKeptRows(rowsRef.current, res.rows, recentRef.current);
        const groups = mergeKeptGroups(groupsRef.current, res.groups, rows);
        rowsRef.current = rows;
        groupsRef.current = groups;
        setData({ groups, rows });
        setSelected((prev) => prev.filter((id) => rows.some((r) => r.optionId === id)));
        setEditing((prev) => prev.filter((id) => rows.some((r) => r.optionId === id)));
        // 사라진 행의 입력값은 버린다. 남은 행의 입력값은 유지 — 조회만으로 사람이 친 숫자를 지우지 않는다.
        setDrafts((prev) =>
          Object.fromEntries(
            Object.entries(prev).filter(([id]) => rows.some((r) => r.optionId === Number(id))),
          ),
        );
      } catch (e) {
        setError(extractErrorMessage(e, '대상 목록을 불러오지 못했습니다.'));
      } finally {
        setIsLoading(false);
      }
    },
    [useCase],
  );

  /**
   * 🔴 탭을 옮기면 이 컴포넌트가 다시 마운트되어 조회를 새로 한다(03 함정 3 — 탭은 서버 축이다).
   * 그때 부를 값은 페이지가 들고 있는 공용 필터다. 마운트 시점 값을 ref 에 잡아 두는 이유는
   * 이 effect 가 필터가 바뀔 때마다 다시 돌면 [새로고침] 없이 자동 재조회가 되어 버리기 때문이다.
   */
  const mountFilter = useRef({ sellerId, platform, scope: formScope });

  useEffect(() => {
    // 인라인 async IIFE — effect 본문에서 동기 setState 를 호출하면 프로젝트 lint 가 막는다.
    void (async () => {
      await load(mountFilter.current);
    })();
  }, [load]);

  /** 실행 직후의 재조회 — 처리 표시는 그대로 둔다(D7). */
  const reload = useCallback(
    () => load({ sellerId, platform, scope: formScope }),
    [load, sellerId, platform, formScope],
  );

  /** [새로고침] — 처리 표시를 비우고 다시 부른다(D7). */
  const refresh = useCallback(() => {
    clearRecent();
    return reload();
  }, [clearRecent, reload]);

  useEffect(() => {
    onBusyChange(isLoading || busy != null);
  }, [isLoading, busy, onBusyChange]);

  const toggle = (optionId: number) => {
    setSelected((prev) =>
      prev.includes(optionId) ? prev.filter((x) => x !== optionId) : [...prev, optionId],
    );
  };

  const toggleAll = (optionIds: number[], checked: boolean) => {
    setSelected((prev) =>
      checked
        ? Array.from(new Set([...prev, ...optionIds]))
        : prev.filter((id) => !optionIds.includes(id)),
    );
  };

  const changeDraft = (optionId: number, value: string) =>
    setDrafts((prev) => ({ ...prev, [optionId]: value }));

  const dropDraft = (optionId: number) =>
    setDrafts((prev) => {
      const next = { ...prev };
      delete next[optionId];
      return next;
    });

  const startEdit = (optionId: number, initial: string) => {
    setDrafts((prev) => ({ ...prev, [optionId]: prev[optionId] ?? initial }));
    setEditing((prev) => (prev.includes(optionId) ? prev : [...prev, optionId]));
  };

  const closeEdit = (optionId: number) => {
    setEditing((prev) => prev.filter((id) => id !== optionId));
    dropDraft(optionId);
  };

  const setBanner = (groupKey: string, banner: RepricingBanner) =>
    setBanners((prev) => ({ ...prev, [groupKey]: banner }));

  const clearBanner = (groupKey: string) =>
    setBanners((prev) => {
      const next = { ...prev };
      delete next[groupKey];
      return next;
    });

  const runRecalculate = async (target: PendingConfirm) => {
    setBusy({ groupKey: target.groupKey, action: 'RECALC', optionId: null });
    clearBanner(target.groupKey);
    try {
      const res = await useCase.recalculate(target.listingIds);
      const failedText =
        res.failed.length > 0
          ? ` · 실패 ${res.failed.length}건 (${res.failed
              .map((f) => `#${f.listingId} ${f.message}`)
              .join(' / ')})`
          : '';
      setBanner(target.groupKey, {
        text: `재계산 상품 ${res.cellCount}건 · 판매가가 바뀐 옵션 ${res.optionChanged}건${failedText} — 마켓에는 아직 반영되지 않았습니다.${HISTORY_HINT}`,
        tone: res.failed.length > 0 ? 'amber' : 'green',
      });
      // 재계산은 그 셀의 AUTO 옵션을 전부 공식값으로 덮는다 — 그 셀에서 편집 중이던 입력값도 같이 버린다.
      for (const row of rowsRef.current) {
        if (target.listingIds.includes(row.listingId)) closeEdit(row.optionId);
      }
      setSelected([]);
      await reload();
    } catch (e) {
      setBanner(target.groupKey, {
        text: extractErrorMessage(e, '재계산에 실패했습니다.'),
        tone: 'red',
      });
    } finally {
      setBusy(null);
    }
  };

  /** 반영에 성공한 옵션 = 보낸 것 − 건너뜀 − 실패. 마지막으로 알던 로컬 판매가를 그대로 기록한다(D7). */
  const markPushed = (
    attemptedIds: number[],
    skipped: RepriceSkippedOption[],
    failed: RepriceFailedOption[],
  ) => {
    const problem = new Set([...skipped.map((x) => x.optionId), ...failed.map((x) => x.optionId)]);
    const at = Date.now();
    const entries: [number, RecentAction][] = [];
    for (const optionId of attemptedIds) {
      if (problem.has(optionId)) continue;
      const row = rowsRef.current.find((r) => r.optionId === optionId);
      const price = row?.sellingPrice ?? row?.newPrice ?? recentRef.current[optionId]?.price ?? null;
      entries.push([optionId, { kind: 'PUSHED', price, at }]);
    }
    if (entries.length > 0) putRecent(entries);
  };

  const runPush = async (target: PendingConfirm) => {
    setBusy({
      groupKey: target.groupKey,
      action: 'PUSH',
      optionId: target.rowLabel != null ? target.optionIds[0] : null,
    });
    clearBanner(target.groupKey);

    // 🔴 서버 상한(200)이 아니라 화면이 정한 묶음 단위로 나눠 순차 전송한다(D26).
    const chunks: number[][] = [];
    for (let i = 0; i < target.optionIds.length; i += REPRICE_PUSH_CHUNK_SIZE) {
      chunks.push(target.optionIds.slice(i, i + REPRICE_PUSH_CHUNK_SIZE));
    }

    let pushed = 0;
    const attempted: number[] = [];
    const skipped: RepriceSkippedOption[] = [];
    const failed: RepriceFailedOption[] = [];
    let stopped = false;
    let retryAfter: string | null = null;

    try {
      for (let i = 0; i < chunks.length; i += 1) {
        if (chunks.length > 1) {
          setBanner(target.groupKey, {
            text: `${i + 1}/${chunks.length} 묶음 진행 중... (반영 ${pushed}건)`,
            tone: 'amber',
          });
        }
        const res = await useCase.push(chunks[i]);
        attempted.push(...chunks[i]);
        pushed += res.pushed;
        skipped.push(...res.skipped);
        failed.push(...res.failed);
        if (res.stopped) {
          stopped = true;
          retryAfter = res.retryAfter;
          break;
        }
      }

      markPushed(attempted, skipped, failed);

      const summary = `반영 ${pushed}건 · 건너뜀 ${skipped.length}건 · 실패 ${failed.length}건`;
      const stoppedText = stopped
        ? ` — 쿠팡 호출 제한으로 중단되었습니다. ${formatRetryAfter(retryAfter)} 이후 남은 건을 다시 반영하세요.`
        : '';
      const skippedText =
        skipped.length > 0
          ? ` (${skipped.map((s) => `${s.optionName}: ${s.reason}`).join(' / ')})`
          : '';
      const failedText =
        failed.length > 0
          ? ` (${failed.map((f) => `${f.optionName}: ${f.message}`).join(' / ')})`
          : '';
      setBanner(target.groupKey, {
        text: `${summary}${skippedText}${failedText}${stoppedText}${HISTORY_HINT}`,
        tone: stopped || failed.length > 0 || skipped.length > 0 ? 'amber' : 'green',
      });
      setSelected([]);
      await reload();
    } catch (e) {
      setBanner(target.groupKey, {
        text: extractErrorMessage(e, '마켓 반영에 실패했습니다.'),
        tone: 'red',
      });
    } finally {
      setBusy(null);
    }
  };

  /**
   * 행 [저장] — 🔴 마켓 호출 0회다. 저장만으로는 실판매가가 그대로여서 그 행은 「미반영」이 켜진다(2609_42 D10).
   * 1건짜리 `override` 요청이고, 확인창 없이 바로 나간다(2609_43 D5·D8).
   */
  const runOverrideRow = async (row: RepricingRow, price: number) => {
    const groupKey = groupKeyOf(row.sellerId, row.platform);
    setBusy({ groupKey, action: 'OVERRIDE', optionId: row.optionId });
    clearBanner(groupKey);
    try {
      const res = await useCase.override([{ optionId: row.optionId, price }]);
      if (res.applied > 0) {
        putRecent([[row.optionId, { kind: 'SAVED', price, at: Date.now() }]]);
        closeEdit(row.optionId);
        setBanner(groupKey, {
          text: `${row.optionName} 판매가를 ${formatWon(price)}으로 저장했습니다 — 마켓에는 아직 반영되지 않았습니다. 그 행의 [마켓 반영]을 눌러야 실제 판매가가 바뀝니다.${HISTORY_HINT}`,
          tone: 'green',
        });
      } else {
        const reason = res.skipped[0]?.reason ?? res.failed[0]?.message ?? '저장되지 않았습니다.';
        setBanner(groupKey, { text: `${row.optionName}: ${reason}`, tone: 'amber' });
      }
      await reload();
    } catch (e) {
      setBanner(groupKey, {
        text: extractErrorMessage(e, '판매가 저장에 실패했습니다.'),
        tone: 'red',
      });
    } finally {
      setBusy(null);
    }
  };

  /** 행 [마켓 반영] — 확인창을 거쳐 1건짜리 `push` 로 나간다(D3·D8). */
  const askPushRow = (row: RepricingRow) =>
    setConfirm({
      action: 'PUSH',
      groupKey: groupKeyOf(row.sellerId, row.platform),
      groupLabel: `${row.listingName} · ${row.optionName}`,
      platform: row.platform,
      listingIds: [],
      optionIds: [row.optionId],
      unsavedCount: 0,
      rowLabel: `${row.listingName} · ${row.optionName}`,
    });

  const handleConfirm = async () => {
    if (!confirm) return;
    const target = confirm;
    setConfirm(null);
    if (target.action === 'RECALC') await runRecalculate(target);
    else await runPush(target);
  };

  const changeFilter = (apply: () => void) => {
    // 필터가 바뀌면 지금 보이는 처리 표시는 다른 범위의 이야기가 된다 — 비운다(D7).
    clearRecent();
    apply();
  };

  return (
    <>
      <Card>
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">판매자</label>
            <select
              className="rounded border border-gray-300 px-2 py-1.5 text-sm text-gray-900"
              value={sellerId}
              onChange={(e) =>
                changeFilter(() => onSellerChange(e.target.value ? Number(e.target.value) : ''))
              }
            >
              <option value="">전체 판매자</option>
              {sellers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.sellerName}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">채널</label>
            <select
              className="rounded border border-gray-300 px-2 py-1.5 text-sm text-gray-900"
              value={platform}
              onChange={(e) => changeFilter(() => onPlatformChange(e.target.value))}
            >
              <option value="">전체 채널</option>
              {PLATFORMS.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-3 pb-1.5 text-sm text-gray-700">
            <label className="flex items-center gap-1">
              <input
                type="radio"
                name="scope"
                checked={formScope === 'BELOW'}
                onChange={() => changeFilter(() => setFormScope('BELOW'))}
              />
              대응 필요만
            </label>
            <label className="flex items-center gap-1">
              <input
                type="radio"
                name="scope"
                checked={formScope === 'ALL'}
                onChange={() => changeFilter(() => setFormScope('ALL'))}
              />
              전체
            </label>
          </div>
          <Button type="button" onClick={() => void refresh()} disabled={isLoading || busy != null}>
            새로고침
          </Button>
        </div>
      </Card>

      {error && <p className="rounded bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      {isLoading ? (
        <Card>
          <div className="flex min-h-32 items-center justify-center">
            <Spinner size={24} label="불러오는 중..." />
          </div>
        </Card>
      ) : data.groups.length === 0 ? (
        <Card>
          <p className="py-6 text-center text-sm text-gray-500">대상 상품이 없습니다.</p>
        </Card>
      ) : (
        data.groups.map((group) => {
          const key = groupKeyOf(group.sellerId, group.platform);
          const rows = data.rows.filter(
            (r) => r.sellerId === group.sellerId && r.platform === group.platform,
          );
          return (
            <RepricingGroupCard
              key={key}
              group={group}
              rows={rows}
              selected={selected}
              onToggle={toggle}
              onToggleAll={toggleAll}
              editing={editing}
              drafts={drafts}
              onDraftChange={changeDraft}
              onEditStart={startEdit}
              onEditCancel={closeEdit}
              onSaveRow={(row, price) => void runOverrideRow(row, price)}
              onPushRow={askPushRow}
              recent={recent}
              busy={busy?.groupKey === key ? busy.action : null}
              busyOptionId={busy?.groupKey === key ? busy.optionId : null}
              banner={banners[key] ?? null}
              onRecalculate={(listingIds, optionIds, unsavedCount) =>
                setConfirm({
                  action: 'RECALC',
                  groupKey: key,
                  groupLabel: `${group.sellerName} · ${group.platform}`,
                  platform: group.platform,
                  listingIds,
                  optionIds,
                  unsavedCount,
                  rowLabel: null,
                })
              }
              onPush={(optionIds) =>
                setConfirm({
                  action: 'PUSH',
                  groupKey: key,
                  groupLabel: `${group.sellerName} · ${group.platform}`,
                  platform: group.platform,
                  listingIds: [],
                  optionIds,
                  unsavedCount: 0,
                  rowLabel: null,
                })
              }
            />
          );
        })
      )}

      <ConfirmDialog
        isOpen={confirm != null}
        title={confirm?.action === 'PUSH' ? '마켓 반영' : '판매가 재계산'}
        isDangerous={confirm?.action === 'PUSH'}
        confirmText={confirm?.action === 'PUSH' ? '마켓 반영' : '재계산'}
        message={
          confirm?.action === 'PUSH' ? (
            <>
              <span className="mb-2 block text-base text-gray-500">{confirm.groupLabel}</span>
              {confirm.rowLabel != null ? (
                <>
                  이 옵션의 판매가가{' '}
                  <span className="font-semibold">{confirm.platform}에 즉시 반영</span>됩니다.
                  되돌리려면 다시 계산해서 반영해야 합니다.
                </>
              ) : (
                <>
                  선택한 {confirm.optionIds.length}개 옵션의 판매가가{' '}
                  <span className="font-semibold">{confirm.platform}에 즉시 반영</span>됩니다.
                  되돌리려면 다시 계산해서 반영해야 합니다.
                </>
              )}
              {confirm.optionIds.length > REPRICE_PUSH_CHUNK_SIZE && (
                <span className="mt-2 block text-base text-gray-500">
                  {REPRICE_PUSH_CHUNK_SIZE}건씩 나눠 순차 전송합니다.
                </span>
              )}
            </>
          ) : (
            <>
              <span className="mb-2 block text-base text-gray-500">{confirm?.groupLabel}</span>
              선택한 <span className="font-semibold">상품 {confirm?.listingIds.length ?? 0}개</span>
              (옵션 {confirm?.optionIds.length ?? 0}개)의 판매가를 다시 계산합니다.{' '}
              <span className="font-semibold">
                같은 상품의 선택하지 않은 옵션도 함께 다시 계산됩니다.
              </span>{' '}
              마켓에는 아직 반영되지 않습니다.
              <span className="mt-2 block">
                직접 지정가 옵션은 <span className="font-semibold">재계산에서 빠집니다.</span>
              </span>
              {(confirm?.unsavedCount ?? 0) > 0 && (
                <span className="mt-2 block font-semibold text-red-600">
                  저장하지 않은 입력값 {confirm?.unsavedCount}건이 공식값으로 대체됩니다.
                </span>
              )}
            </>
          )
        }
        onConfirm={() => void handleConfirm()}
        onCancel={() => setConfirm(null)}
      />
    </>
  );
}
