'use client';

import { useEffect, useState } from 'react';
import { Spinner } from '@/presentation/components/Spinner';
import { PopupDialogModal } from '@/presentation/components/PopupDialogModal';
import { ShippingOverrideFields } from '@/presentation/components/ShippingOverrideFields';
import { extractErrorMessage } from '@/infrastructure/utils/errorMessage';
import {
  channelDivergesFromMaster,
  EMPTY_SHIPPING_OVERRIDE,
  mapToOverride,
  overrideToMap,
  type ShippingOverride,
} from '@/domain/entities/ShippingEntity';
import type { MasterProductUseCase } from '@/application/usecases/MasterProductUseCase';

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
}

/**
 * 마스터 배송 override 편집 패널 (마스터 상세). 계정 배송설정(74)을 기본값으로 두고
 * 배송 고유속성을 이 마스터의 **전 채널**에 적용하는 override 를 편집한다(공통 ShippingOverrideFields level="master").
 * File: src/app/dashboard/master-products/[id]/components/MasterShippingOverridePanel.tsx
 *
 * ⚠️ 출고지/반품지는 계정별 등록 센터라 마스터 override 불가(level="master" 가 숨김, 백엔드도 조용히 무시).
 * 비운 값은 계정 배송설정을 상속, 채워진 값은 이 마스터의 전 채널에 적용. 저장 성공 후 onSaved(매트릭스 재조회).
 *
 * [선택 채널에 강제 적용](77/79) = 선택한 채널의 배송 설정을 이 마스터 설정으로 **덮어쓴다**(채널이 그 값을
 * 소유하므로 이후 마스터를 바꿔도 그 채널엔 자동 반영되지 않는다). 출고지/반품지는 계정별 등록 센터라 보존.
 * ⚠️ 덮어쓰기는 채널이 개별 설정해 둔 값을 되돌릴 수 없이 지우므로 **적용 대상 채널을 골라서** 실행한다.
 * [저장]은 개별 설정이 **없는** 채널에만 닿는다(상속). 그래서 저장 직후 자기 설정을 가진 채널이 있으면
 * "N개 채널이 개별 배송 설정을 갖고 있어 이 변경이 반영되지 않습니다" 배너 + [해당 채널에 적용](81) 로
 * 그 채널만 선택된 강제 적용 다이얼로그를 연다. 판정 = `channelDivergesFromMaster`(안내 전용, 정답은 백엔드).
 *
 * ⚠️ 강제 적용은 **서버에 저장된** 마스터 override 를 읽는다 → 저장하지 않은 편집이 있으면 **먼저 저장한 뒤**
 * 적용한다(그러지 않으면 화면의 값이 무시되고 옛 값이 채널에 써진다). 마스터 override 가 비어 있으면 적용은
 * 채널 설정을 **지우는** 동작이므로 다이얼로그·배너가 그렇게 말한다.
 */
export function MasterShippingOverridePanel({
  masterId,
  useCase,
  channels,
  onSaved,
}: MasterShippingOverridePanelProps) {
  const [override, setOverride] = useState<ShippingOverride>(EMPTY_SHIPPING_OVERRIDE);
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
  const formMap = overrideToMap(override);
  const isDirty = JSON.stringify(formMap) !== JSON.stringify(overrideToMap(savedOverride));
  // An empty master override means force-apply ERASES the selected channels' shipping settings
  // (they fall back to the account default) — the dialog and banner must say so.
  const masterIsEmpty = Object.keys(formMap).length === 0;

  const persist = async () => {
    await useCase.updateShippingOverride(masterId, { override: overrideToMap(override) });
    setSavedOverride(override);
  };

  const handleSave = async () => {
    try {
      setIsSaving(true);
      setError('');
      setSaved(false);
      await persist();
      setSaved(true);
      // A channel that owns these keys keeps its own values — the save does not reach it (81).
      // Surface that here, where the user just pressed 저장 and would otherwise see only success.
      const savedMap = overrideToMap(override);
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
      setApplyBanner(
        masterIsEmpty
          ? res.affectedChannels > 0
            ? `${res.affectedChannels}개 채널의 개별 배송 설정을 지웠습니다 — 마스터에 배송 설정이 없어 계정 기본값을 따릅니다`
            : '변경된 채널이 없습니다 — 마스터에 배송 설정이 없습니다'
          : res.affectedChannels > 0
            ? `${res.affectedChannels}개 채널의 배송 설정을 이 마스터 설정으로 덮어썼습니다`
            : '선택한 채널은 이미 이 마스터 설정과 같습니다 — 변경된 채널이 없습니다',
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
    <div className="rounded-lg bg-white p-4 shadow">
      <h2 className="mb-1 text-sm font-semibold text-gray-900">배송 설정 (전 채널)</h2>
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
          <ShippingOverrideFields
            level="master"
            value={override}
            onChange={(next) => {
              setOverride(next);
              setSaved(false);
            }}
            platform="COUPANG"
            disabled={busy}
          />

          {saved && !error && <p className="text-sm text-green-700">배송 설정을 저장했습니다.</p>}
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
            <button
              type="button"
              onClick={handleSave}
              disabled={busy}
              className="px-3 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 disabled:bg-blue-400 disabled:cursor-not-allowed transition-colors inline-flex items-center gap-2"
            >
              {isSaving ? <Spinner label="저장 중..." /> : '저장'}
            </button>

            <button
              type="button"
              onClick={() => openPicker()}
              disabled={busy || channels.length === 0}
              title={channels.length === 0 ? '연결된 채널이 없습니다.' : undefined}
              className="px-3 py-2 border border-gray-300 text-gray-700 text-sm font-medium rounded-md hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors inline-flex items-center gap-2"
            >
              {isApplying ? <Spinner label="적용 중..." /> : '채널에 강제 적용'}
            </button>
          </div>

          <p className="text-xs text-gray-500">
            저장은 개별 설정이 없는 채널에 자동 반영됩니다. 강제 적용은 선택한 채널의 배송 설정을 이 마스터
            설정으로 덮어씁니다(그 채널은 이후 마스터 변경을 따르지 않습니다).
          </p>
        </div>
      )}

      <PopupDialogModal
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
