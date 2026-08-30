'use client';

import { useState } from 'react';
import { Spinner } from '@/presentation/components/Spinner';
import { PopupDialogModal } from '@/presentation/components/PopupDialogModal';
import { extractErrorMessage } from '@/infrastructure/utils/errorMessage';
import type { MasterProductResponse } from '@/domain/entities/MasterProductEntity';
import type { MasterProductUseCase } from '@/application/usecases/MasterProductUseCase';

interface MasterBasicInfoPanelProps {
  master: MasterProductResponse; // initial values come from the parent (no getById here)
  useCase: MasterProductUseCase; // owned by parent container (CoverageMatrix)
  onSaved: (patched: MasterProductResponse) => void; // parent updates its master state in place
}

/**
 * 마스터 기본 정보(이름·활성) 인라인 편집 패널 + 구성상품 읽기 전용 목록 (마스터 상세).
 * File: src/app/dashboard/master-products/[id]/components/MasterBasicInfoPanel.tsx
 *
 * 초기값은 부모가 내려준 `master` 를 쓴다(패널이 `getById` 를 다시 부르지 않는다).
 * 저장은 **자기 필드만** PATCH(`{ name, active }`) — 백엔드 PATCH 는 null=기존 유지라
 * 다른 필드를 함께 보내면 같은 화면의 다른 섹션 편집을 덮어쓴다.
 * 저장 성공 후 `onSaved(patched)` 로만 통지한다(매트릭스 재조회 금지 — 이름 한 줄 저장에
 * 매트릭스 + 셀별 getGenerated N콜이 다시 도는 것을 막는다).
 *
 * ⚠️ 구성상품(BOM)은 생성 시 고정 — 여기서 추가/삭제하지 않는다(읽기 전용).
 * ⚠️ `active=false` 는 soft delete 라 **끄는 방향에만** 확인 다이얼로그를 띄운다.
 */
export function MasterBasicInfoPanel({ master, useCase, onSaved }: MasterBasicInfoPanelProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [name, setName] = useState(master.name);
  const [active, setActive] = useState(master.active);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  // Deactivation confirm (soft delete). Only the on→off direction asks.
  const [confirmOff, setConfirmOff] = useState(false);

  const startEdit = () => {
    setName(master.name);
    setActive(master.active);
    setError('');
    setSaved(false);
    setIsEditing(true);
  };

  const cancelEdit = () => {
    setIsEditing(false);
    setError('');
  };

  // Cancelling the dialog leaves `active` untouched → the checkbox stays checked.
  const handleActiveChange = (next: boolean) => {
    setSaved(false);
    if (next) setActive(true);
    else setConfirmOff(true);
  };

  const handleSave = async () => {
    try {
      setIsSaving(true);
      setError('');
      setSaved(false);
      const patched = await useCase.update(master.id, { name: name.trim(), active });
      setIsEditing(false);
      setSaved(true);
      // Transient confirmation — auto-dismiss (project has no toast system).
      setTimeout(() => setSaved(false), 2500);
      onSaved(patched);
    } catch (err) {
      setError(extractErrorMessage(err, '기본 정보 저장에 실패했습니다.'));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="p-4">
      {error && <p className="mb-3 rounded bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      <div className="space-y-4">
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-600">마스터 이름 *</label>
          {isEditing ? (
            <input
              className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm text-gray-900"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setSaved(false);
              }}
              disabled={isSaving}
            />
          ) : (
            <p className="rounded bg-gray-50 px-3 py-2 text-sm text-gray-800">{master.name}</p>
          )}
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-gray-600">활성 (active)</label>
          {isEditing ? (
            <label className="flex items-center gap-2 text-sm text-gray-900">
              <input
                type="checkbox"
                checked={active}
                onChange={(e) => handleActiveChange(e.target.checked)}
                disabled={isSaving}
              />
              활성
            </label>
          ) : (
            <p className="text-sm text-gray-800">{master.active ? '활성' : '비활성'}</p>
          )}
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-gray-600">
            구성상품 ({master.components.length}개)
          </label>
          <div className="max-h-64 overflow-y-auto rounded border border-gray-200 bg-gray-50">
            {master.components.length === 0 ? (
              <p className="px-3 py-2 text-sm text-gray-500">구성상품이 없습니다.</p>
            ) : (
              <ul className="divide-y divide-gray-200">
                {master.components.map((c) => (
                  <li key={c.productId} className="px-3 py-2 text-sm text-gray-800">
                    {c.productName}
                  </li>
                ))}
              </ul>
            )}
          </div>
          <p className="mt-1 text-[11px] text-gray-500">
            생성 후에는 구성상품을 추가하거나 뺄 수 없습니다(고정).
          </p>
        </div>

        {saved && !error && <p className="text-sm text-green-700">기본 정보를 저장했습니다.</p>}

        {isEditing ? (
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleSave}
              disabled={isSaving || name.trim() === ''}
              className="px-3 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 disabled:bg-blue-400 disabled:cursor-not-allowed transition-colors inline-flex items-center gap-2"
            >
              {isSaving ? <Spinner label="저장 중..." /> : '저장'}
            </button>
            <button
              type="button"
              onClick={cancelEdit}
              disabled={isSaving}
              className="px-3 py-2 border border-gray-300 text-gray-700 text-sm font-medium rounded-md hover:bg-gray-100 disabled:opacity-50 transition-colors"
            >
              취소
            </button>
            {name.trim() === '' && <p className="text-xs text-red-600">마스터 이름을 입력하세요.</p>}
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

      <PopupDialogModal
        isOpen={confirmOff}
        title="마스터 비활성화"
        message="비활성화하면 목록에서 숨겨집니다. 계속하시겠습니까?"
        confirmText="비활성화"
        isDangerous
        onConfirm={() => {
          setActive(false);
          setConfirmOff(false);
        }}
        onCancel={() => setConfirmOff(false)}
      />
    </div>
  );
}
