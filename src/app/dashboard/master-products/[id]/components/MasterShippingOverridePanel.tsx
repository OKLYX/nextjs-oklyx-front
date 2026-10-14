'use client';

import { useEffect, useState } from 'react';
import { Spinner } from '@/presentation/components/Spinner';
import { ConfirmDialog } from '@/presentation/components/ui/ConfirmDialog';
import { extractErrorMessage } from '@/infrastructure/utils/errorMessage';
import {
  channelDivergesFromMaster,
  EMPTY_SHIPPING_OVERRIDE,
  mapToOverride,
  type ShippingOverride,
} from '@/domain/entities/ShippingEntity';
import {
  pickElevenst,
  tierError,
  withRecalcNote,
  type ElevenstShippingMap,
} from '@/domain/entities/ElevenstShipping';
import type { LookupPlatform } from '../../components/platformCategory';
import {
  ALL_SHIPPING_TAB,
  MasterShippingTabs,
  masterShippingMapOf,
  shippingPlatformsOf,
  type MasterShippingTab,
} from './MasterShippingTabs';
import type { MasterProductUseCase } from '@/application/usecases/MasterProductUseCase';
import { Button } from '@/presentation/components/ui/Button';

/** One registered channel cell of this master — the force-apply selection unit (79). */
export interface ForceApplyChannel {
  listingId: number;
  label: string; // 판매자 · 플랫폼 (matrix row label)
  // The channel's own shipping override (81). undefined = not loaded / fetch failed → excluded from
  // the "이 저장이 닿지 않는 채널" hint so it never over-reports.
  override?: Record<string, string> | null;
}

interface MasterShippingOverridePanelProps {
  masterId: number;
  useCase: MasterProductUseCase; // owned by parent container (CoverageMatrix)
  channels: ForceApplyChannel[]; // registered cells, for the force-apply picker (79)
  onSaved: () => void; // matrix reload so cells pick up the new override resolution
  /** Platforms with a switched-on sales channel (FEATURE_2610_13 / D98) — decide the D104 tabs. */
  activePlatforms: LookupPlatform[];
}

/**
 * Master shipping override panel (master detail). The sales channel's shipping settings (74) are the default; this
 * panel edits the override that applies to **every channel** of this master — through {@link MasterShippingTabs}
 * (FEATURE_2610_13 / D104: the Coupang fields `ShippingOverrideFields level="master"` and, with a switched-on 11st
 * channel, the 11st fields, in 「통합」 + per-platform tabs).
 * File: src/app/dashboard/master-products/[id]/components/MasterShippingOverridePanel.tsx
 *
 * ⚠️ Outbound / return places are centers registered per account, so the master cannot override them (hidden on the
 * master level, and the backend drops them silently). A blank value inherits the account settings, a filled value
 * applies to every channel of this master. After a successful save → onSaved (matrix reload).
 *
 * [선택 채널에 강제 적용] (77/79) = **overwrite** the selected channels' shipping settings with this master's (the
 * channel then owns those values, so later master changes no longer reach it automatically). Outbound / return
 * places are per-account centers and are kept. Since FEATURE_2610_13 / D104 each channel takes only its own
 * platform's keys.
 * ⚠️ The overwrite erases values a channel set itself and cannot be undone, so it runs on **channels picked** in the
 * dialog.
 * [저장] reaches only channels **without** their own settings (inheritance). So when, right after a save, some
 * channels hold their own settings, the banner 「N개 채널이 개별 배송 설정을 갖고 있어 이 변경이 반영되지 않습니다」 +
 * [해당 채널에 적용] (81) opens the force-apply dialog with only those channels picked. Judged by
 * `channelDivergesFromMaster` (hint only, the backend is the truth).
 *
 * ⚠️ Force-apply reads the **saved** master override → with unsaved edits it **saves first** and then applies
 * (otherwise the on-screen values would be ignored and old values written to the channels). An empty master
 * override makes the apply **erase** the channel settings, and the dialog and banner say so.
 *
 * FEATURE_2610_13 / D120: the server re-prices the 11st listings after either action; when some could not be
 * re-priced, 「저장했습니다」 and the force-apply banner carry 「가격을 다시 계산하지 못한 상품 n개 …」.
 */
export function MasterShippingOverridePanel({
  masterId,
  useCase,
  channels,
  onSaved,
  activePlatforms,
}: MasterShippingOverridePanelProps) {
  const [override, setOverride] = useState<ShippingOverride>(EMPTY_SHIPPING_OVERRIDE);
  // FEATURE_2610_13 / D104: the 11st keys of the same master map, edited in their own fields.
  const [elevenst, setElevenst] = useState<ElevenstShippingMap>({});
  const [savedElevenst, setSavedElevenst] = useState<ElevenstShippingMap>({});
  const [tab, setTab] = useState<MasterShippingTab>(ALL_SHIPPING_TAB);
  // D120: 11st listings the last master save could not re-price.
  const [recalcFailed, setRecalcFailed] = useState(0);
  const platforms = shippingPlatformsOf(activePlatforms);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  // What the server currently holds — force-apply reads the SAVED master, so unsaved edits must be
  // persisted first or the apply would silently push stale values onto the channels.
  const [savedOverride, setSavedOverride] = useState<ShippingOverride>(EMPTY_SHIPPING_OVERRIDE);
  // Force-apply (77/79): its own busy/confirm/banner state so it never shares the save spinner.
  const [isApplying, setIsApplying] = useState(false);
  const [confirmApply, setConfirmApply] = useState(false);
  const [applyBanner, setApplyBanner] = useState('');
  // Channels selected in the confirm dialog (79). Seeded to "all" each time the dialog opens.
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [pickerError, setPickerError] = useState('');
  // Channels that hold their own settings and so did NOT receive the last save (81).
  const [staleIds, setStaleIds] = useState<number[]>([]);
  // Whether the open dialog was seeded from that hint (affects the dialog's lead line only).
  const [pickerFromHint, setPickerFromHint] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      setIsLoading(true);
      setError('');
      try {
        const master = await useCase.getById(masterId);
        if (!alive) return;
        const loaded = mapToOverride(master.shippingOverride);
        setOverride(loaded);
        setSavedOverride(loaded);
        const loadedElevenst = pickElevenst(master.shippingOverride);
        setElevenst(loadedElevenst);
        setSavedElevenst(loadedElevenst);
      } catch {
        if (alive) setError('배송 설정을 불러오지 못했습니다.');
      } finally {
        if (alive) setIsLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [useCase, masterId]);

  // Serialized override maps — the comparison unit for "is the form still what the server holds?"
  const formMap = masterShippingMapOf(override, elevenst);
  const isDirty =
    JSON.stringify(formMap) !== JSON.stringify(masterShippingMapOf(savedOverride, savedElevenst));
  // An empty master override means force-apply ERASES the selected channels' shipping settings
  // (they fall back to the account default) — the dialog and banner must say so.
  const masterIsEmpty = Object.keys(formMap).length === 0;

  // Both platforms' keys go out together — the server keeps one map (D104).
  const persist = async () => {
    const res = await useCase.updateShippingOverride(masterId, {
      override: masterShippingMapOf(override, elevenst),
    });
    setRecalcFailed(res.priceRecalcFailedCount ?? 0);
    setSavedOverride(override);
    setSavedElevenst(elevenst);
  };

  const handleSave = async () => {
    // D106: the 11st quantity tiers must chain before anything is sent.
    const tierMessage = tierError(elevenst);
    if (tierMessage) {
      setError(tierMessage);
      return;
    }
    try {
      setIsSaving(true);
      setError('');
      setSaved(false);
      await persist();
      setSaved(true);
      // A channel that owns these keys keeps its own values — the save does not reach it (81).
      // Surface that here, where the user just pressed 저장 and would otherwise see only success.
      const savedMap = masterShippingMapOf(override, elevenst);
      setStaleIds(
        channels
          .filter((c) => channelDivergesFromMaster(c.override, savedMap))
          .map((c) => c.listingId),
      );
      // Transient confirmation — auto-dismiss (project has no toast system).
      setTimeout(() => setSaved(false), 2500);
      onSaved();
    } catch (err) {
      setError(extractErrorMessage(err, '배송 설정 저장에 실패했습니다.'));
    } finally {
      setIsSaving(false);
    }
  };

  const openPicker = (preselect?: number[]) => {
    // Default to every channel; the user unchecks the ones to leave alone. When opened from the
    // "이 저장이 닿지 않는 채널" hint, only those channels start checked (81).
    setSelectedIds(new Set(preselect ?? channels.map((c) => c.listingId)));
    setPickerFromHint(preselect != null);
    setPickerError('');
    setApplyBanner('');
    setError('');
    setConfirmApply(true);
  };

  const toggleChannel = (listingId: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(listingId)) next.delete(listingId);
      else next.add(listingId);
      return next;
    });
    setPickerError('');
  };

  const allSelected = channels.length > 0 && selectedIds.size === channels.length;

  const toggleAll = () => {
    setSelectedIds(allSelected ? new Set() : new Set(channels.map((c) => c.listingId)));
    setPickerError('');
  };

  const handleForceApply = async () => {
    const tierMessage = tierError(elevenst);
    if (isDirty && tierMessage) {
      setConfirmApply(false);
      setError(tierMessage);
      return;
    }
    if (selectedIds.size === 0) {
      // Keep the dialog open — an empty apply is a mis-click, not a request.
      setPickerError('적용할 채널을 하나 이상 선택하세요.');
      return;
    }
    const listingIds = channels
      .map((c) => c.listingId)
      .filter((id) => selectedIds.has(id));
    setConfirmApply(false);
    try {
      setIsApplying(true);
      setError('');
      setApplyBanner('');
      // Force-apply reads the SAVED master override, so persist the on-screen edits first —
      // otherwise the user's just-made change is silently ignored and stale values are pushed.
      if (isDirty) {
        await persist();
      }
      const res = await useCase.applyShippingOverrideToChannels(masterId, { listingIds });
      // 0 = idempotent no-op, a normal response — never render it as a failure. And when the master
      // has no shipping settings the apply ERASES the channels' own ones: say that, don't call it
      // "덮어썼습니다" (that reads as if master values had been pushed).
      // D120: the apply's own re-price failures follow the banner text.
      setApplyBanner(
        withRecalcNote(
          masterIsEmpty
            ? res.affectedChannels > 0
              ? `${res.affectedChannels}개 채널의 개별 배송 설정을 지웠습니다 — 마스터에 배송 설정이 없어 계정 기본값을 따릅니다`
              : '변경된 채널이 없습니다 — 마스터에 배송 설정이 없습니다'
            : res.affectedChannels > 0
              ? `${res.affectedChannels}개 채널의 배송 설정을 이 마스터 설정으로 덮어썼습니다`
              : '선택한 채널은 이미 이 마스터 설정과 같습니다 — 변경된 채널이 없습니다',
          res.priceRecalcFailedCount,
        ),
      );
      setStaleIds([]); // those channels now match the master (or were deliberately left out)
      onSaved();
    } catch (err) {
      setError(extractErrorMessage(err, '강제 적용에 실패했습니다.'));
    } finally {
      setIsApplying(false);
    }
  };

  const busy = isSaving || isApplying;

  return (
    // 「배송 설정」 탭 안에서 기본 택배/상자 아래 블록이다 — 카드 껍데기 없이 형제 블록과 같은 p-4.
    <div className="p-4">
      <h3 className="mb-1 text-sm font-semibold text-gray-900">전 채널 배송</h3>
      <p className="mb-3 text-xs text-gray-500">
        비운 값은 판매채널의 기본 배송 설정을 그대로 쓰고, 채워진 값은 이 마스터의 전 채널에 적용됩니다.
        (출고지·반품지는 채널에서만 지정)
      </p>

      {error && <p className="mb-3 rounded bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      {isLoading ? (
        <div className="flex min-h-16 items-center justify-center">
          <Spinner size={20} label="불러오는 중..." />
        </div>
      ) : (
        <div className="space-y-4">
          <MasterShippingTabs
            platforms={platforms}
            tab={tab}
            onTabChange={setTab}
            coupang={override}
            onCoupangChange={(next) => {
              setOverride(next);
              setSaved(false);
            }}
            elevenst={elevenst}
            onElevenstChange={(next) => {
              setElevenst(next);
              setSaved(false);
            }}
            disabled={busy}
          />

          {saved && !error && (
            <p className="text-sm text-green-700">
              {withRecalcNote('배송 설정을 저장했습니다.', recalcFailed)}
            </p>
          )}
          {applyBanner && !error && <p className="text-sm text-green-700">{applyBanner}</p>}

          {staleIds.length > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-2 rounded bg-blue-50 px-3 py-2">
              <p className="text-sm text-blue-700">
                {staleIds.length}개 채널이 개별 배송 설정을 갖고 있어 이 변경이 반영되지 않습니다.
              </p>
              <button
                type="button"
                onClick={() => openPicker(staleIds)}
                disabled={busy}
                className="rounded border border-blue-300 bg-white px-2 py-1 text-xs font-medium text-blue-700 hover:bg-blue-100 disabled:opacity-50"
              >
                해당 채널에 적용
              </button>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              onClick={handleSave}
              disabled={busy}
              className="inline-flex items-center gap-2"
            >
              {isSaving ? <Spinner label="저장 중..." /> : '저장'}
            </Button>

            {/* D104: one force-apply button — on the 「통합」 tab when there are tabs. */}
            {(platforms.length < 2 || tab === ALL_SHIPPING_TAB) && (
              <button
                type="button"
                onClick={() => openPicker()}
                disabled={busy || channels.length === 0}
                title={channels.length === 0 ? '연결된 채널이 없습니다.' : undefined}
                className="px-3 py-2 border border-gray-300 text-gray-700 text-sm font-medium rounded-md hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors inline-flex items-center gap-2"
              >
                {isApplying ? <Spinner label="적용 중..." /> : '채널에 강제 적용'}
              </button>
            )}
          </div>

          <p className="text-xs text-gray-500">
            저장은 개별 설정이 없는 채널에 자동 반영됩니다. 강제 적용은 선택한 채널의 배송 설정을 이 마스터
            설정으로 덮어씁니다(그 채널은 이후 마스터 변경을 따르지 않습니다).
          </p>
        </div>
      )}

      <ConfirmDialog
        isOpen={confirmApply}
        title="선택한 채널에 강제 적용"
        message={
          <div className="space-y-3">
            <p className="text-sm text-gray-600">
              선택한 채널의 배송 설정이 이 마스터 설정으로 덮어써집니다(되돌릴 수 없습니다). 출고지·반품지는
              계정별 설정이라 그대로 유지됩니다.
            </p>

            {pickerFromHint && (
              <p className="text-sm text-gray-500">이 변경이 반영되지 않는 채널만 선택했습니다.</p>
            )}

            {masterIsEmpty && (
              <p className="rounded bg-amber-50 px-3 py-2 text-sm text-amber-700">
                ⚠️ 이 마스터에는 배송 설정이 없습니다. 지금 적용하면 선택한 채널의 개별 배송 설정이 지워지고
                계정 기본값을 따르게 됩니다.
              </p>
            )}

            {isDirty && (
              <p className="rounded bg-blue-50 px-3 py-2 text-sm text-blue-700">
                저장하지 않은 변경이 있습니다 — 먼저 저장한 뒤 적용합니다.
              </p>
            )}

            <label className="flex items-center gap-2 border-b pb-2 text-sm font-medium text-gray-700">
              <input type="checkbox" checked={allSelected} onChange={toggleAll} />
              전체 선택 ({selectedIds.size}/{channels.length})
            </label>

            <div className="max-h-64 space-y-1 overflow-y-auto">
              {channels.map((c) => (
                <label key={c.listingId} className="flex items-center gap-2 text-sm text-gray-700">
                  <input
                    type="checkbox"
                    checked={selectedIds.has(c.listingId)}
                    onChange={() => toggleChannel(c.listingId)}
                  />
                  {c.label}
                </label>
              ))}
            </div>

            {pickerError && <p className="text-sm text-red-600">{pickerError}</p>}
          </div>
        }
        confirmText="강제 적용"
        isDangerous
        onConfirm={handleForceApply}
        onCancel={() => setConfirmApply(false)}
      />
    </div>
  );
}
