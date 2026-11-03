'use client';

import { useState } from 'react';
import { Modal } from '@/presentation/components/ui/Modal';
import { Button } from '@/presentation/components/ui/Button';
import { Input } from '@/presentation/components/ui/Input';
import { BOX_KIND_LABEL, boxKindOf, type Package } from '@/domain/entities/PackageEntity';
import type { CreatePackageRequest } from '@/application/dto/CreatePackageRequest';

/**
 * Name of the shared 「재활용 상자(미등록)」 box (2026-11-03 user decision).
 *
 * Picked when a recycled box of unknown kind was used. The server needs a registered box id (on
 * [이 박스 완료] and on a box change), so one recycled box with this name and cost 0 is created **once** and reused.
 * Finding / creating it lives in `unregisteredRecycledBox.ts` (`findOrCreateUnregisteredRecycledBox`) — the only
 * place; screens call it (FEATURE_2611_06 / D17).
 * ⚠️ Completing with this box may be remembered as the suggested box of that item set — accepted by the user.
 */
export const UNREGISTERED_RECYCLED_BOX_TYPE = '재활용 상자(미등록)';

/** 고른 것 — 등록된 상자 번호, 또는 공용 미등록 재활용 상자 */
type BoxPick = number | 'UNREGISTERED' | null;

/**
 * The 「박스 변경」 dialog (2026-11-03 user request · FEATURE_2611_06 / D10 · D17 · D18).
 *
 * **File**: src/app/dashboard/stock/packing/components/BoxChangeModal.tsx
 *
 * Opened from three places — one dialog, never copied:
 * 1. Packing screen 「박스 추천」 card (B → X, or the button) — the box being packed.
 * 2. Packing screen order detail (opened from a 「오늘 완료」 row) [상자 변경] — the box of a packed parcel, above the
 *    order detail (`nested`).
 * 3. 「포장 이력」 [상자 변경] on a 「포장 완료」 row — the box of that parcel.
 *
 * What it can do:
 * 1. Change to another registered box — picks from all boxes even when a suggestion exists.
 * 2. 「재활용 상자 사용」 checkbox — only recycled boxes stay in the list. When the kind is unknown, pick
 *    「{@link UNREGISTERED_RECYCLED_BOX_TYPE}」 at the top (found / created by `unregisteredRecycledBox.ts`).
 * 3. Register a new box — once saved it becomes the box at once. Its kind follows the checkbox (recycled = cost 0 ok).
 *
 * 🔴 State starts fresh on every open — the opener mounts it only while open (unmounts on close).
 * 🔴 The opener calls the APIs (`onPick` · `onPickUnregistered` · `onCreate`). This dialog only hands up the pick;
 *    a rejected promise keeps it open with the error text inside.
 * 🔴 The packing screen's global scan keys are off while this dialog is up (page `enabled`) — typed text never
 *    reaches the scan buffer.
 */
export interface BoxChangeModalProps {
  packages: Package[];
  selectedPackageId: number | null;
  onClose: () => void;
  /**
   * A registered box was picked. A completed-parcel box change returns a promise and the dialog waits for it
   * (closes on success, shows the error text on failure)
   */
  onPick: (packageId: number) => void | Promise<void>;
  /** 공용 미등록 재활용 상자를 골랐다 — 페이지가 찾거나 만들어서 고른다 */
  onPickUnregistered: () => Promise<void>;
  /** 새 상자 등록 — 페이지가 저장하고 목록에 넣고 고른다 */
  onCreate: (request: CreatePackageRequest) => Promise<void>;
  /** `true` = opened above another modal (the packing screen order detail) — passed straight to `Modal` */
  nested?: boolean;
}

export function BoxChangeModal({
  packages,
  selectedPackageId,
  onClose,
  onPick,
  onPickUnregistered,
  onCreate,
  nested = false,
}: BoxChangeModalProps) {
  const selected = packages.find((pkg) => pkg.id === selectedPackageId);
  const [recycled, setRecycled] = useState(selected ? boxKindOf(selected) === 'RECYCLED' : false);
  const [pick, setPick] = useState<BoxPick>(
    selected?.type === UNREGISTERED_RECYCLED_BOX_TYPE ? 'UNREGISTERED' : selectedPackageId
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const [newType, setNewType] = useState('');
  const [newWidth, setNewWidth] = useState('');
  const [newLength, setNewLength] = useState('');
  const [newHeight, setNewHeight] = useState('');
  const [newCost, setNewCost] = useState('');

  // 공용 미등록 상자는 목록에 따로(맨 위) 그린다 — 같은 상자가 두 줄로 보이지 않게 뺀다
  const listed = packages.filter(
    (pkg) =>
      pkg.type !== UNREGISTERED_RECYCLED_BOX_TYPE && (!recycled || boxKindOf(pkg) === 'RECYCLED')
  );

  const toggleRecycled = (next: boolean) => {
    setRecycled(next);
    // 체크하면 「어떤 상자인지 모름」이 기본이다 — 등록된 재활용 상자를 쓰면 목록에서 고른다
    if (next) setPick('UNREGISTERED');
    else if (pick === 'UNREGISTERED') setPick(null);
  };

  const apply = async () => {
    if (pick === null) {
      setError('상자를 고르세요');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      if (pick === 'UNREGISTERED') await onPickUnregistered();
      else await onPick(pick);
      onClose();
    } catch (e) {
      setError(e instanceof Error && e.message ? e.message : '상자를 바꾸지 못했습니다');
    } finally {
      setSubmitting(false);
    }
  };

  const create = async () => {
    const width = Number(newWidth);
    const length = Number(newLength);
    const height = Number(newHeight);
    const cost = newCost.trim() === '' ? (recycled ? 0 : NaN) : Number(newCost);
    if (!newType.trim()) {
      setError('상자 이름을 입력하세요');
      return;
    }
    if (![width, length, height].every((value) => Number.isFinite(value) && value >= 0.1)) {
      setError('가로 · 세로 · 높이를 0.1cm 이상으로 입력하세요');
      return;
    }
    if (!Number.isFinite(cost) || cost < 0 || (!recycled && cost === 0)) {
      setError(recycled ? '비용을 0원 이상으로 입력하세요' : '구매 상자는 비용을 1원 이상 입력하세요');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      await onCreate({
        type: newType.trim(),
        cost,
        widthCm: width,
        lengthCm: length,
        heightCm: height,
        isDefault: false,
        boxKind: recycled ? 'RECYCLED' : 'PURCHASED',
      });
      onClose();
    } catch (e) {
      setError(e instanceof Error && e.message ? e.message : '상자를 등록하지 못했습니다');
    } finally {
      setSubmitting(false);
    }
  };

  const rowClass = (active: boolean) =>
    `flex w-full items-center justify-between rounded-lg border px-3 py-2 text-left text-sm ${
      active ? 'border-blue-600 bg-blue-50' : 'border-gray-200 bg-white hover:border-gray-300'
    }`;

  return (
    <Modal
      isOpen
      nested={nested}
      onClose={onClose}
      title="박스 변경"
      disableClose={submitting}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={submitting}>
            취소
          </Button>
          <Button onClick={() => void apply()} isLoading={submitting} loadingText="바꾸는 중...">
            이 상자로 변경
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <label className="flex items-center gap-2 text-sm font-medium text-gray-900">
          <input
            type="checkbox"
            checked={recycled}
            onChange={(event) => toggleRecycled(event.target.checked)}
          />
          재활용 상자 사용
        </label>

        <div className="space-y-2">
          {recycled && (
            <button
              type="button"
              className={rowClass(pick === 'UNREGISTERED')}
              onClick={() => setPick('UNREGISTERED')}
            >
              <span className="font-medium text-gray-900">{UNREGISTERED_RECYCLED_BOX_TYPE}</span>
              <span className="text-xs text-gray-700">어떤 상자인지 모를 때</span>
            </button>
          )}
          {listed.map((pkg) => (
            <button
              key={pkg.id}
              type="button"
              className={rowClass(pick === pkg.id)}
              onClick={() => setPick(pkg.id)}
            >
              <span className="font-medium text-gray-900">{pkg.type}</span>
              <span className="text-xs text-gray-700">
                {pkg.widthCm} × {pkg.lengthCm} × {pkg.heightCm} cm · {BOX_KIND_LABEL[boxKindOf(pkg)]}
              </span>
            </button>
          ))}
          {listed.length === 0 && !recycled && (
            <p className="text-sm text-gray-700">등록된 상자가 없습니다. 아래에서 새 상자를 등록하세요.</p>
          )}
        </div>

        <div className="space-y-2 border-t border-gray-100 pt-3">
          <p className="text-sm font-medium text-gray-900">
            새 상자 등록 ({recycled ? BOX_KIND_LABEL.RECYCLED : BOX_KIND_LABEL.PURCHASED})
          </p>
          <Input label="상자 이름" value={newType} onChange={(event) => setNewType(event.target.value)} />
          <div className="grid grid-cols-3 gap-2">
            <Input label="가로(cm)" type="number" value={newWidth} onChange={(event) => setNewWidth(event.target.value)} />
            <Input label="세로(cm)" type="number" value={newLength} onChange={(event) => setNewLength(event.target.value)} />
            <Input label="높이(cm)" type="number" value={newHeight} onChange={(event) => setNewHeight(event.target.value)} />
          </div>
          <Input
            label="비용(원)"
            type="number"
            value={newCost}
            hint={recycled ? '재활용 상자는 비워 두면 0원입니다' : undefined}
            onChange={(event) => setNewCost(event.target.value)}
          />
          <Button variant="secondary" onClick={() => void create()} disabled={submitting}>
            등록하고 이 상자로 변경
          </Button>
        </div>

        {error && <p className="text-sm font-medium text-red-600">{error}</p>}
      </div>
    </Modal>
  );
}
