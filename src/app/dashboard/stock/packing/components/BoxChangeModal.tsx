'use client';

import { useState } from 'react';
import { Modal } from '@/presentation/components/ui/Modal';
import { Button } from '@/presentation/components/ui/Button';
import { Input } from '@/presentation/components/ui/Input';
import { BOX_KIND_LABEL, boxKindOf, type Package } from '@/domain/entities/PackageEntity';
import type { CreatePackageRequest } from '@/application/dto/CreatePackageRequest';

/**
 * 공용 「등록하지 않은 재활용 상자」의 이름 (2026-11-03 사용자 결정).
 *
 * 어떤 상자인지 모르는 재활용 상자를 썼을 때 고르는 상자다. 서버는 [이 박스 완료] 에 등록된 상자 번호를
 * 요구하므로, 이 이름의 재활용·비용 0원 상자를 **한 번만** 만들어 두고 계속 쓴다(페이지가 찾거나 만든다).
 * ⚠️ 이 상자로 완료하면 그 물품 조합의 추천 상자로 기억될 수 있다 — 사용자가 받아들인 동작이다.
 */
export const UNREGISTERED_RECYCLED_BOX_TYPE = '재활용 상자(미등록)';

/** 고른 것 — 등록된 상자 번호, 또는 공용 미등록 재활용 상자 */
type BoxPick = number | 'UNREGISTERED' | null;

/**
 * [박스 변경] 창 — 포장 작업 「박스 추천」 카드에서 연다(B → X, 또는 버튼). 2026-11-03 사용자 지시.
 *
 * **파일**: src/app/dashboard/stock/packing/components/BoxChangeModal.tsx
 *
 * 할 수 있는 일 세 가지:
 * 1. 등록된 다른 상자로 변경 — 추천 상자가 있어도 전체 상자에서 고른다.
 * 2. 「재활용 상자 사용」 체크 — 목록이 재활용 상자만 남는다. 어떤 상자인지 모르면 맨 위
 *    「{@link UNREGISTERED_RECYCLED_BOX_TYPE}」를 고른다.
 * 3. 새 상자 등록 — 등록하면 바로 이 송장의 상자가 된다. 종류는 체크 상태를 따른다(재활용이면 비용 0원 가능).
 *
 * 🔴 상태는 열 때마다 새로 시작한다 — 페이지가 열려 있을 때만 마운트한다(닫으면 지운다).
 * 🔴 API 는 페이지가 부른다(`onCreate` · `onPickUnregistered`). 이 창은 고른 값만 올린다.
 * 🔴 전역 스캔 키는 이 창이 떠 있는 동안 꺼진다(페이지 `enabled`) — 입력칸 글자가 스캔 버퍼로 가지 않는다.
 */
export interface BoxChangeModalProps {
  packages: Package[];
  selectedPackageId: number | null;
  onClose: () => void;
  /** 등록된 상자를 골랐다 */
  onPick: (packageId: number) => void;
  /** 공용 미등록 재활용 상자를 골랐다 — 페이지가 찾거나 만들어서 고른다 */
  onPickUnregistered: () => Promise<void>;
  /** 새 상자 등록 — 페이지가 저장하고 목록에 넣고 고른다 */
  onCreate: (request: CreatePackageRequest) => Promise<void>;
}

export function BoxChangeModal({
  packages,
  selectedPackageId,
  onClose,
  onPick,
  onPickUnregistered,
  onCreate,
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
      else onPick(pick);
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
