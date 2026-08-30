'use client';

import { useState } from 'react';
import { Spinner } from '@/presentation/components/Spinner';
import { extractErrorMessage } from '@/infrastructure/utils/errorMessage';
import type { MasterProductResponse } from '@/domain/entities/MasterProductEntity';
import type { CarrierRate } from '@/domain/entities/CarrierRateEntity';
import type { Package } from '@/domain/entities/PackageEntity';
import type { MasterProductUseCase } from '@/application/usecases/MasterProductUseCase';

interface MasterDefaultCostPanelProps {
  master: MasterProductResponse; // initial values come from the parent (no getById here)
  useCase: MasterProductUseCase; // owned by parent container (CoverageMatrix)
  carrierRates: CarrierRate[]; // loaded once by the parent, shared with the option editor
  packages: Package[];
  onSaved: (patched: MasterProductResponse) => void; // parent updates its master state in place
}

const formatWon = (v: number | null | undefined) =>
  v == null ? '—' : `${v.toLocaleString('ko-KR')}원`;

export const carrierLabel = (r: CarrierRate) => `${r.carrier} ${r.type} · ${formatWon(r.cost)}`;
export const packageLabel = (p: Package) => `${p.type} · ${formatWon(p.cost)}`;

/**
 * 마스터 기본 택배비/상자비 인라인 편집 패널 (마스터 상세).
 * File: src/app/dashboard/master-products/[id]/components/MasterDefaultCostPanel.tsx
 *
 * 옵션이 개별 지정하지 않으면 이 값이 모든 옵션 판매가 계산에 쓰인다.
 * 후보 목록(`carrierRates`/`packages`)은 부모가 한 번 로드해 주입한다(패널 재조회 금지).
 * 저장은 **자기 필드만** PATCH(`{ defaultDeliveryId, defaultPackageId }`) 후 `onSaved(patched)`.
 *
 * ⚠️ **두 select 는 필수 — "선택 안 함" 빈 옵션을 두지 말 것**. `MasterProductUpdateRequest` 의
 * 두 필드는 `Long`(null=기존 유지)이라 **빈값으로 되돌리는(해제) 경로가 자체가 없다** —
 * 빈값을 보내면 `undefined` 라 백엔드가 조용히 무시해 "저장했는데 안 바뀐다"로 보인다.
 * 그래서 미선택 상태에서는 [저장] 을 막고 사유를 인라인으로 알린다.
 */
export function MasterDefaultCostPanel({
  master,
  useCase,
  carrierRates,
  packages,
  onSaved,
}: MasterDefaultCostPanelProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [deliveryId, setDeliveryId] = useState<number | ''>(master.defaultDeliveryId ?? '');
  const [packageId, setPackageId] = useState<number | ''>(master.defaultPackageId ?? '');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);

  const currentCarrier = carrierRates.find((r) => r.id === master.defaultDeliveryId);
  const currentPackage = packages.find((p) => p.id === master.defaultPackageId);

  const startEdit = () => {
    setDeliveryId(master.defaultDeliveryId ?? '');
    setPackageId(master.defaultPackageId ?? '');
    setError('');
    setSaved(false);
    setIsEditing(true);
  };

  const incomplete = deliveryId === '' || packageId === '';

  const handleSave = async () => {
    if (incomplete) return;
    try {
      setIsSaving(true);
      setError('');
      setSaved(false);
      const patched = await useCase.update(master.id, {
        defaultDeliveryId: Number(deliveryId),
        defaultPackageId: Number(packageId),
      });
      setIsEditing(false);
      setSaved(true);
      // Transient confirmation — auto-dismiss (project has no toast system).
      setTimeout(() => setSaved(false), 2500);
      onSaved(patched);
    } catch (err) {
      setError(extractErrorMessage(err, '기본 택배/상자 저장에 실패했습니다.'));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="p-4">
      {error && <p className="mb-3 rounded bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">기본 택배비 *</label>
            {isEditing ? (
              <select
                className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm text-gray-900"
                value={deliveryId}
                disabled={isSaving}
                onChange={(e) => {
                  setDeliveryId(e.target.value ? Number(e.target.value) : '');
                  setSaved(false);
                }}
              >
                {/* No blank option on purpose — see the panel doc (there is no "unset" path). */}
                {deliveryId === '' && <option value="">택배를 선택하세요</option>}
                {carrierRates.map((r) => (
                  <option key={r.id} value={r.id}>
                    {carrierLabel(r)}
                  </option>
                ))}
              </select>
            ) : (
              <p className="rounded bg-gray-50 px-3 py-2 text-sm text-gray-800">
                {currentCarrier ? carrierLabel(currentCarrier) : '미지정'}
              </p>
            )}
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">기본 상자비 *</label>
            {isEditing ? (
              <select
                className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm text-gray-900"
                value={packageId}
                disabled={isSaving}
                onChange={(e) => {
                  setPackageId(e.target.value ? Number(e.target.value) : '');
                  setSaved(false);
                }}
              >
                {packageId === '' && <option value="">상자를 선택하세요</option>}
                {packages.map((p) => (
                  <option key={p.id} value={p.id}>
                    {packageLabel(p)}
                  </option>
                ))}
              </select>
            ) : (
              <p className="rounded bg-gray-50 px-3 py-2 text-sm text-gray-800">
                {currentPackage ? packageLabel(currentPackage) : '미지정'}
              </p>
            )}
          </div>
        </div>

        <p className="text-[11px] text-gray-500">
          옵션에서 개별 지정하지 않으면 이 값이 모든 옵션 판매가 계산에 쓰입니다.
        </p>

        {saved && !error && <p className="text-sm text-green-700">기본 택배/상자를 저장했습니다.</p>}

        {isEditing ? (
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleSave}
              disabled={isSaving || incomplete}
              className="px-3 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 disabled:bg-blue-400 disabled:cursor-not-allowed transition-colors inline-flex items-center gap-2"
            >
              {isSaving ? <Spinner label="저장 중..." /> : '저장'}
            </button>
            <button
              type="button"
              onClick={() => {
                setIsEditing(false);
                setError('');
              }}
              disabled={isSaving}
              className="px-3 py-2 border border-gray-300 text-gray-700 text-sm font-medium rounded-md hover:bg-gray-100 disabled:opacity-50 transition-colors"
            >
              취소
            </button>
            {incomplete && (
              <p className="text-xs text-red-600">
                기본 택배비와 상자비를 모두 선택해야 저장할 수 있습니다(해제는 불가).
              </p>
            )}
          </div>
        ) : (
          <button
            type="button"
            onClick={startEdit}
            className="px-3 py-2 border border-gray-300 text-gray-700 text-sm font-medium rounded-md hover:bg-gray-100 transition-colors"
          >
            수정
          </button>
        )}
      </div>
    </div>
  );
}
