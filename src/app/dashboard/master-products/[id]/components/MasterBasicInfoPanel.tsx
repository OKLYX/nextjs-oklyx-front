'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Spinner } from '@/presentation/components/Spinner';
import { extractErrorMessage } from '@/infrastructure/utils/errorMessage';
import type { MasterProductResponse } from '@/domain/entities/MasterProductEntity';
import type { MasterProductUseCase } from '@/application/usecases/MasterProductUseCase';
import { Button } from '@/presentation/components/ui/Button';
import { Input } from '@/presentation/components/ui/Input';
import { ROUTES } from '@/config/routes';

interface MasterBasicInfoPanelProps {
  master: MasterProductResponse; // initial values come from the parent (no getById here)
  useCase: MasterProductUseCase; // owned by parent container (CoverageMatrix)
  onSaved: (patched: MasterProductResponse) => void; // parent updates its master state in place
}

/**
 * 마스터 기본 정보(이름) 인라인 편집 패널 + 구성상품 읽기 전용 목록 (마스터 상세).
 * File: src/app/dashboard/master-products/[id]/components/MasterBasicInfoPanel.tsx
 *
 * 초기값은 부모가 내려준 `master` 를 쓴다(패널이 `getById` 를 다시 부르지 않는다).
 * 저장은 **자기 필드만** PATCH(`{ name }`) — 백엔드 PATCH 는 null=기존 유지라
 * 다른 필드를 함께 보내면 같은 화면의 다른 섹션 편집을 덮어쓴다.
 * 저장 성공 후 `onSaved(patched)` 로만 통지한다(매트릭스 재조회 금지 — 이름 한 줄 저장에
 * 매트릭스 + 셀별 getGenerated N콜이 다시 도는 것을 막는다).
 *
 * ⚠️ 구성상품은 여기서 읽기 전용이다. 변경은 [구성상품 변경] → 전용 페이지(2609_64)에서 한다 —
 * 구성과 옵션 수량은 서로를 검증하므로 한 요청으로 같이 저장돼야 한다.
 * ⚠️ 마스터를 치우는 길은 [삭제](하드 삭제, 2609_72)뿐이다 — 비활성 토글은 없앴다
 * (같은 일을 하는 버튼이 둘이었고, 비활성은 목록에서 사라져 되돌릴 길이 화면에 없었다).
 * ⚠️ 삭제 버튼은 **이 패널이 아니라 상세 머리말 오른쪽**에 있다(목록에도 하나 있다).
 * 여기에 두 번째 삭제 버튼을 만들지 말 것.
 */
export function MasterBasicInfoPanel({ master, useCase, onSaved }: MasterBasicInfoPanelProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [name, setName] = useState(master.name);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const router = useRouter();

  const startEdit = () => {
    setName(master.name);
    setError('');
    setSaved(false);
    setIsEditing(true);
  };

  const cancelEdit = () => {
    setIsEditing(false);
    setError('');
  };

  const handleSave = async () => {
    try {
      setIsSaving(true);
      setError('');
      setSaved(false);
      const patched = await useCase.update(master.id, { name: name.trim() });
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
            <Input
              size="sm"
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
          {/* 구성상품이 보이는 자리가 곧 고치러 오는 자리다 — 진입 버튼을 목록 옆에 둔다. */}
          <div className="mb-1 flex items-center justify-between gap-2">
            <label className="block text-xs font-medium text-gray-600">
              구성상품 ({master.components.length}개)
            </label>
            <button
              type="button"
              onClick={() => router.push(ROUTES.MASTER_PRODUCT_COMPOSITION(master.id))}
              className="rounded border border-gray-300 px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-100"
            >
              구성상품 변경
            </button>
          </div>
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
            구성상품을 바꾸려면 [구성상품 변경] 에서 옵션별 수량과 함께 저장하세요.
          </p>
        </div>

        {saved && !error && <p className="text-sm text-green-700">기본 정보를 저장했습니다.</p>}

        {isEditing ? (
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              onClick={handleSave}
              disabled={isSaving || name.trim() === ''}
              className="inline-flex items-center gap-2"
            >
              {isSaving ? <Spinner label="저장 중..." /> : '저장'}
            </Button>
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
    </div>
  );
}
