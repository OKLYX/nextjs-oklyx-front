'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { PageContainer } from '@/presentation/components/PageContainer';
import { Spinner } from '@/presentation/components/Spinner';
import { Card } from '@/presentation/components/ui/Card';
import { Button } from '@/presentation/components/ui/Button';
import { ConfirmDialog } from '@/presentation/components/ui/ConfirmDialog';
import { RepricingUseCase } from '@/application/usecases/RepricingUseCase';
import { RepricingRepositoryImpl } from '@/infrastructure/repositories/RepricingRepositoryImpl';
import { SellerUseCase } from '@/application/usecases/SellerUseCase';
import { SellerRepositoryImpl } from '@/infrastructure/repositories/SellerRepositoryImpl';
import { PLATFORMS } from '@/config/platforms';
import { extractErrorMessage } from '@/infrastructure/utils/errorMessage';
import type { Seller } from '@/domain/entities/SellerEntity';
import {
  REPRICE_PUSH_CHUNK_SIZE,
  type PriceOverrideItem,
  type RepriceFailedOption,
  type RepriceSkippedOption,
  type RepricingCandidatesResponse,
  type RepricingScope,
} from '@/domain/entities/RepricingEntity';
import {
  RepricingGroupCard,
  type RepricingAction,
  type RepricingBanner,
} from './components/RepricingGroupCard';

const groupKeyOf = (sellerId: number, platform: string) => `${sellerId}::${platform}`;

/** 429 쿨다운 재시도 시각. 「잠시 후」로 쓰면 사용자가 계속 누른다(PLAN 2609_39 D26 — 쿨다운 약 10분). */
const formatRetryAfter = (iso: string | null) => {
  if (!iso) return '';
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) return '';
  return at.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
};

interface PendingConfirm {
  action: RepricingAction;
  groupKey: string;
  groupLabel: string;
  platform: string;
  listingIds: number[];
  optionIds: number[];
  /** OVERRIDE 일 때 저장할 입력값. 다른 동작에서는 빈 배열 */
  items: PriceOverrideItem[];
  /** RECALC 일 때 그 그룹에서 덮어써질 입력값 수 */
  editedCount: number;
}

/**
 * 판매가 관리 콘솔 — 마진 경보 목록 + [재계산] → [마켓 반영] 2단계 실행(FEATURE_2609_39).
 * File: src/app/dashboard/listings/repricing/page.tsx
 *
 * 🔴 `dashboard/listings/sync` 와 **다른 화면**이다(PLAN 2609_39 D12): 저쪽은 콘텐츠 재전송(재심사),
 *    여기는 가격 전송이다. 두 기능을 한 표에 합치지 않는다.
 * 🔴 [마켓 반영]은 승인 없이 **실제 판매가를 즉시 바꾼다** — 확인 모달 없이 전송하지 않는다(D7).
 * 🔴 [마켓 반영]은 한 번에 {@link REPRICE_PUSH_CHUNK_SIZE} 건씩 나눠 순차 호출한다(D26 — 서버 상한 200 의
 *    실제 소요가 미측정이라 504 구간이다). 숫자는 그 상수 한 곳에서만 고친다.
 * 🔴 실행 버튼은 셋이고 마켓에 나가는 것은 [마켓 반영] **하나뿐**이다(FEATURE_2609_42 D1):
 *    [재계산] = 공식으로 다시 계산(상품 단위) · [입력값 저장] = 사람이 친 값을 로컬에 저장(옵션 단위) ·
 *    [마켓 반영] = 저장된 값을 전송(실판매가가 즉시 바뀐다).
 * 🔴 [재계산]과 [입력값 저장]은 **같은 칸을 덮어쓴다** — 입력값이 있는 상태로 재계산하면 그 값은 공식값으로 대체된다.
 * 자동 폴링 없음 — 모든 갱신은 수동 트리거(sync 콘솔과 같은 자세).
 */
export default function ListingsRepricingPage() {
  const useCase = useMemo(() => new RepricingUseCase(new RepricingRepositoryImpl()), []);
  const sellerUseCase = useMemo(() => new SellerUseCase(new SellerRepositoryImpl()), []);

  const [sellers, setSellers] = useState<Seller[]>([]);
  const [formSellerId, setFormSellerId] = useState<number | ''>('');
  const [formPlatform, setFormPlatform] = useState('');
  const [formScope, setFormScope] = useState<RepricingScope>('BELOW');

  const [data, setData] = useState<RepricingCandidatesResponse>({ groups: [], rows: [] });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  const [selected, setSelected] = useState<number[]>([]);
  /** optionId → 「새 판매가」 입력칸 문자열. 화면에만 있는 값이고 [입력값 저장] 으로만 서버에 간다(2609_42 D1) */
  const [drafts, setDrafts] = useState<Record<number, string>>({});
  const [busy, setBusy] = useState<{ groupKey: string; action: RepricingAction } | null>(null);
  const [banners, setBanners] = useState<Record<string, RepricingBanner>>({});
  const [confirm, setConfirm] = useState<PendingConfirm | null>(null);

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
        setData(res);
        setSelected((prev) => prev.filter((id) => res.rows.some((r) => r.optionId === id)));
        // 사라진 행의 입력값은 버린다. 남은 행의 입력값은 유지 — 조회만으로 사람이 친 숫자를 지우지 않는다.
        setDrafts((prev) =>
          Object.fromEntries(
            Object.entries(prev).filter(([id]) => res.rows.some((r) => r.optionId === Number(id))),
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

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const list = await sellerUseCase.getAll();
        if (alive) setSellers(list);
      } catch {
        // 판매자 목록 실패는 필터만 비게 두고 본 목록 조회는 계속한다.
      }
    })();
    return () => {
      alive = false;
    };
  }, [sellerUseCase]);

  useEffect(() => {
    // 인라인 async IIFE — effect 본문에서 동기 setState 를 호출하면 프로젝트 lint 가 막는다.
    void (async () => {
      await load({ sellerId: '', platform: '', scope: 'BELOW' });
    })();
  }, [load]);

  const reload = useCallback(
    () => load({ sellerId: formSellerId, platform: formPlatform, scope: formScope }),
    [load, formSellerId, formPlatform, formScope],
  );

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

  const dropDrafts = (optionIds: number[]) =>
    setDrafts((prev) => {
      const next = { ...prev };
      for (const id of optionIds) delete next[id];
      return next;
    });

  const setBanner = (groupKey: string, banner: RepricingBanner) =>
    setBanners((prev) => ({ ...prev, [groupKey]: banner }));

  const clearBanner = (groupKey: string) =>
    setBanners((prev) => {
      const next = { ...prev };
      delete next[groupKey];
      return next;
    });

  const runRecalculate = async (target: PendingConfirm) => {
    setBusy({ groupKey: target.groupKey, action: 'RECALC' });
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
        text: `재계산 상품 ${res.cellCount}건 · 판매가가 바뀐 옵션 ${res.optionChanged}건${failedText} — 마켓에는 아직 반영되지 않았습니다.`,
        tone: res.failed.length > 0 ? 'amber' : 'green',
      });
      // 재계산은 그 셀의 AUTO 옵션을 전부 공식값으로 덮는다 — 그 셀에 남아 있던 입력값도 같이 버린다.
      dropDrafts(
        data.rows.filter((r) => target.listingIds.includes(r.listingId)).map((r) => r.optionId),
      );
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

  const runPush = async (target: PendingConfirm) => {
    setBusy({ groupKey: target.groupKey, action: 'PUSH' });
    clearBanner(target.groupKey);

    // 🔴 서버 상한(200)이 아니라 화면이 정한 묶음 단위로 나눠 순차 전송한다(D26).
    const chunks: number[][] = [];
    for (let i = 0; i < target.optionIds.length; i += REPRICE_PUSH_CHUNK_SIZE) {
      chunks.push(target.optionIds.slice(i, i + REPRICE_PUSH_CHUNK_SIZE));
    }

    let pushed = 0;
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
        pushed += res.pushed;
        skipped.push(...res.skipped);
        failed.push(...res.failed);
        if (res.stopped) {
          stopped = true;
          retryAfter = res.retryAfter;
          break;
        }
      }

      const summary = `반영 ${pushed}건 · 건너뜀 ${skipped.length}건 · 실패 ${failed.length}건`;
      const stoppedText = stopped
        ? ` — 쿠팡 호출 제한으로 중단되었습니다. ${formatRetryAfter(retryAfter)} 이후 남은 건을 다시 반영하세요.`
        : '';
      const failedText =
        failed.length > 0
          ? ` (${failed.map((f) => `${f.optionName}: ${f.message}`).join(' / ')})`
          : '';
      setBanner(target.groupKey, {
        text: `${summary}${failedText}${stoppedText}`,
        tone: stopped || failed.length > 0 ? 'amber' : 'green',
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
   * 입력값 저장 — 🔴 마켓 호출 0회다. 저장만으로는 실판매가가 그대로여서 그 행은 「미반영」이 켜진다(D10).
   * 상한은 [마켓 반영]과 같은 축이라 같은 묶음 단위로 나눠 보낸다(D7).
   */
  const runOverride = async (target: PendingConfirm) => {
    setBusy({ groupKey: target.groupKey, action: 'OVERRIDE' });
    clearBanner(target.groupKey);

    const chunks: PriceOverrideItem[][] = [];
    for (let i = 0; i < target.items.length; i += REPRICE_PUSH_CHUNK_SIZE) {
      chunks.push(target.items.slice(i, i + REPRICE_PUSH_CHUNK_SIZE));
    }

    let applied = 0;
    const skipped: RepriceSkippedOption[] = [];
    const failed: RepriceFailedOption[] = [];

    try {
      for (let i = 0; i < chunks.length; i += 1) {
        if (chunks.length > 1) {
          setBanner(target.groupKey, {
            text: `${i + 1}/${chunks.length} 묶음 저장 중... (저장 ${applied}건)`,
            tone: 'amber',
          });
        }
        const res = await useCase.override(chunks[i]);
        applied += res.applied;
        skipped.push(...res.skipped);
        failed.push(...res.failed);
      }

      const problemIds = new Set([
        ...skipped.map((x) => x.optionId),
        ...failed.map((x) => x.optionId),
      ]);
      // 저장된 칸만 비운다 — 건너뛴·실패한 칸은 사람이 고쳐 다시 누를 수 있게 입력값을 남긴다.
      dropDrafts(target.items.map((x) => x.optionId).filter((id) => !problemIds.has(id)));

      const detail = [
        skipped.length > 0
          ? ` · 건너뜀 ${skipped.length}건 (${skipped
              .map((x) => `${x.optionName}: ${x.reason}`)
              .join(' / ')})`
          : '',
        failed.length > 0
          ? ` · 실패 ${failed.length}건 (${failed
              .map((x) => `${x.optionName}: ${x.message}`)
              .join(' / ')})`
          : '',
      ].join('');

      setBanner(target.groupKey, {
        text: `판매가 저장 ${applied}건${detail} — 마켓에는 아직 반영되지 않았습니다. 해당 행의 「미반영」을 확인하고 [선택 마켓 반영]을 눌러야 실제 판매가가 바뀝니다.`,
        tone: skipped.length > 0 || failed.length > 0 ? 'amber' : 'green',
      });
      await reload();
    } catch (e) {
      setBanner(target.groupKey, {
        text: extractErrorMessage(e, '판매가 저장에 실패했습니다.'),
        tone: 'red',
      });
    } finally {
      setBusy(null);
    }
  };

  const handleConfirm = async () => {
    if (!confirm) return;
    const target = confirm;
    setConfirm(null);
    if (target.action === 'RECALC') await runRecalculate(target);
    else if (target.action === 'OVERRIDE') await runOverride(target);
    else await runPush(target);
  };

  return (
    <PageContainer title="판매가 관리">
      <Card>
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">판매자</label>
            <select
              className="rounded border border-gray-300 px-2 py-1.5 text-sm text-gray-900"
              value={formSellerId}
              onChange={(e) => setFormSellerId(e.target.value ? Number(e.target.value) : '')}
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
              value={formPlatform}
              onChange={(e) => setFormPlatform(e.target.value)}
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
                onChange={() => setFormScope('BELOW')}
              />
              대응 필요만
            </label>
            <label className="flex items-center gap-1">
              <input
                type="radio"
                name="scope"
                checked={formScope === 'ALL'}
                onChange={() => setFormScope('ALL')}
              />
              전체
            </label>
          </div>
          <Button type="button" onClick={() => void reload()} disabled={isLoading || busy != null}>
            조회
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
              drafts={drafts}
              onDraftChange={changeDraft}
              busy={busy?.groupKey === key ? busy.action : null}
              banner={banners[key] ?? null}
              onRecalculate={(listingIds, optionIds, editedCount) =>
                setConfirm({
                  action: 'RECALC',
                  groupKey: key,
                  groupLabel: `${group.sellerName} · ${group.platform}`,
                  platform: group.platform,
                  listingIds,
                  optionIds,
                  items: [],
                  editedCount,
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
                  items: [],
                  editedCount: 0,
                })
              }
              onOverride={(items) =>
                setConfirm({
                  action: 'OVERRIDE',
                  groupKey: key,
                  groupLabel: `${group.sellerName} · ${group.platform}`,
                  platform: group.platform,
                  listingIds: [],
                  optionIds: items.map((x) => x.optionId),
                  items,
                  editedCount: items.length,
                })
              }
            />
          );
        })
      )}

      <ConfirmDialog
        isOpen={confirm != null}
        title={
          confirm?.action === 'PUSH'
            ? '마켓 반영'
            : confirm?.action === 'OVERRIDE'
              ? '입력값 저장'
              : '판매가 재계산'
        }
        isDangerous={confirm?.action === 'PUSH'}
        confirmText={
          confirm?.action === 'PUSH'
            ? '마켓 반영'
            : confirm?.action === 'OVERRIDE'
              ? '저장'
              : '재계산'
        }
        message={
          confirm?.action === 'OVERRIDE' ? (
            <>
              <span className="mb-2 block text-base text-gray-500">{confirm.groupLabel}</span>
              직접 입력한 <span className="font-semibold">{confirm.items.length}개 옵션</span>의 판매가를
              저장합니다.
              <span className="mt-2 block">
                <span className="font-semibold">마켓에는 아직 반영되지 않습니다.</span> 저장 후 [선택 마켓
                반영]을 눌러야 실제 판매가가 바뀝니다.
              </span>
              <span className="mt-2 block">
                <span className="font-semibold">다음 재계산 때 공식으로 계산된 값으로 되돌아갑니다.</span>{' '}
                계속 유지하려면 옵션 편집에서 직접 지정가로 넣으세요.
              </span>
              {confirm.items.length > REPRICE_PUSH_CHUNK_SIZE && (
                <span className="mt-2 block text-base text-gray-500">
                  {REPRICE_PUSH_CHUNK_SIZE}건씩 나눠 순차 저장합니다.
                </span>
              )}
            </>
          ) : confirm?.action === 'PUSH' ? (
            <>
              <span className="mb-2 block text-base text-gray-500">{confirm.groupLabel}</span>
              선택한 {confirm.optionIds.length}개 옵션의 판매가가{' '}
              <span className="font-semibold">{confirm.platform}에 즉시 반영</span>됩니다. 되돌리려면
              다시 계산해서 반영해야 합니다.
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
              {(confirm?.editedCount ?? 0) > 0 && (
                <span className="mt-2 block font-semibold text-red-600">
                  직접 입력한 {confirm?.editedCount}건의 값이 공식값으로 대체됩니다.
                </span>
              )}
            </>
          )
        }
        onConfirm={() => void handleConfirm()}
        onCancel={() => setConfirm(null)}
      />
    </PageContainer>
  );
}
