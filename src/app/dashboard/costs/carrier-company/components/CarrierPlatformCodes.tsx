'use client';

/**
 * 택배사별 "플랫폼 코드"(예: COUPANG→CJGLS)를 관리하는 인라인 편집 컴포넌트.
 *
 * **용도**: 택배사 관리 화면에서 택배사 행을 펼치면 그 아래에 렌더되어,
 *   해당 택배사의 플랫폼별 택배사 코드 목록 조회 + 추가/수정/삭제를 담당.
 * **파일**: src/app/dashboard/costs/carrier-company/components/CarrierPlatformCodes.tsx
 *
 * **Props**:
 * - carrierId: number — 코드를 조회/편집할 대상 택배사 ID (필수)
 *
 * **자체 상태**: codes / isLoading / error / editingId / isAdding / isSubmitting.
 *   마운트 시 getCodes(carrierId)로 lazy 로드. mutation 후 재조회.
 *
 * **사용 예제**:
 *   <CarrierPlatformCodes carrierId={carrier.id} />
 *
 * ⚠️ 추가/수정은 인라인 입력행 전용 — 모달/다이얼로그로 구현하지 말 것.
 * ⚠️ platform은 자유 입력 금지 → PLATFORM_OPTIONS(<select>)만 사용 (오타로 인한 매핑 실패 방지).
 * ❌ 이 컴포넌트를 carrier CRUD(CarrierContainer) 상태에 끌어올리지 말 것 — 자체 관리.
 */

import { useEffect, useMemo, useState } from 'react';
import type { PlatformCarrierCode } from '@/domain/entities/PlatformCarrierCodeEntity';
import { PlatformCarrierCodeUseCase } from '@/application/usecases/PlatformCarrierCodeUseCase';
import { PlatformCarrierCodeRepositoryImpl } from '@/infrastructure/repositories/PlatformCarrierCodeRepositoryImpl';
import { PLATFORM_OPTIONS } from '@/app/dashboard/sellers/list/components/ChannelEditForm';

interface CarrierPlatformCodesProps {
  carrierId: number;
}

// PLATFORM_OPTIONS(SSOT) 기반 한글 라벨. 매핑에 없으면 코드 원문 표시.
function platformLabel(platform: string): string {
  return PLATFORM_OPTIONS.find((o) => o.value === platform)?.label ?? platform;
}

const DEFAULT_PLATFORM = PLATFORM_OPTIONS[0]?.value ?? '';

export function CarrierPlatformCodes({ carrierId }: CarrierPlatformCodesProps) {
  const useCase = useMemo(
    () => new PlatformCarrierCodeUseCase(new PlatformCarrierCodeRepositoryImpl()),
    [],
  );

  const [codes, setCodes] = useState<PlatformCarrierCode[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [editingId, setEditingId] = useState<number | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  // Inline form fields (shared by add row and edit row).
  const [platform, setPlatform] = useState(DEFAULT_PLATFORM);
  const [deliveryCompanyCode, setDeliveryCompanyCode] = useState('');

  const loadCodes = async () => {
    setIsLoading(true);
    setError('');
    try {
      const data = await useCase.getCodes(carrierId);
      setCodes(data);
    } catch {
      setError('코드를 불러오지 못했습니다.');
      setCodes([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const init = async () => {
      await loadCodes();
    };
    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [carrierId]);

  const resetForm = () => {
    setPlatform(DEFAULT_PLATFORM);
    setDeliveryCompanyCode('');
    setFormError('');
  };

  const openAdd = () => {
    setEditingId(null);
    resetForm();
    setIsAdding(true);
  };

  const openEdit = (code: PlatformCarrierCode) => {
    setIsAdding(false);
    setFormError('');
    setEditingId(code.id);
    setPlatform(code.platform);
    setDeliveryCompanyCode(code.deliveryCompanyCode);
  };

  const cancelForm = () => {
    setIsAdding(false);
    setEditingId(null);
    resetForm();
  };

  const isFormValid = platform.trim() !== '' && deliveryCompanyCode.trim() !== '';

  const handleError = (err: unknown) => {
    const status =
      typeof err === 'object' && err !== null && 'response' in err
        ? (err as { response?: { status?: number } }).response?.status
        : undefined;
    setFormError(status === 409 ? '이미 등록된 플랫폼입니다.' : '저장하지 못했습니다. 다시 시도해주세요.');
  };

  const handleCreate = async () => {
    if (!isFormValid) return;
    setIsSubmitting(true);
    setFormError('');
    try {
      await useCase.create(carrierId, { platform, deliveryCompanyCode });
      cancelForm();
      await loadCodes();
    } catch (err) {
      handleError(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdate = async (codeId: number) => {
    if (!isFormValid) return;
    setIsSubmitting(true);
    setFormError('');
    try {
      await useCase.update(carrierId, codeId, { platform, deliveryCompanyCode });
      cancelForm();
      await loadCodes();
    } catch (err) {
      handleError(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (code: PlatformCarrierCode) => {
    if (!window.confirm(`'${platformLabel(code.platform)}' 코드를 삭제하시겠습니까?`)) return;
    setError('');
    try {
      await useCase.delete(carrierId, code.id);
      await loadCodes();
    } catch {
      setError('삭제하지 못했습니다. 다시 시도해주세요.');
    }
  };

  const inlineForm = (onSave: () => void) => (
    <div className="flex flex-wrap items-center gap-2 py-2">
      <select
        value={platform}
        onChange={(e) => setPlatform(e.target.value)}
        className="px-2 py-1 border border-gray-300 rounded text-sm text-gray-700"
      >
        {PLATFORM_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <input
        type="text"
        value={deliveryCompanyCode}
        onChange={(e) => setDeliveryCompanyCode(e.target.value)}
        placeholder="택배사 코드 (예: CJGLS)"
        className="px-2 py-1 border border-gray-300 rounded text-sm text-gray-700"
      />
      <button
        type="button"
        onClick={onSave}
        disabled={!isFormValid || isSubmitting}
        className="px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        저장
      </button>
      <button
        type="button"
        onClick={cancelForm}
        disabled={isSubmitting}
        className="px-3 py-1 border border-gray-300 rounded text-sm text-gray-700 hover:bg-gray-100 transition-colors"
      >
        취소
      </button>
      {formError && <span className="text-sm text-red-600">{formError}</span>}
    </div>
  );

  if (isLoading) {
    return <div className="px-6 py-3 text-sm text-gray-500">불러오는 중...</div>;
  }

  if (error) {
    return (
      <div className="px-6 py-3 flex items-center gap-3">
        <span className="text-sm text-red-600">{error}</span>
        <button
          type="button"
          onClick={loadCodes}
          className="px-3 py-1 border border-gray-300 rounded text-sm text-gray-700 hover:bg-gray-100 transition-colors"
        >
          다시 시도
        </button>
      </div>
    );
  }

  return (
    <div className="px-6 py-3 bg-gray-50">
      <div className="grid grid-cols-[1fr_1fr_auto] items-center gap-2 pb-2 text-xs font-semibold text-gray-500">
        <span>플랫폼</span>
        <span>코드</span>
        <span className="text-right">관리</span>
      </div>

      {codes.length === 0 && !isAdding && (
        <div className="py-2 text-sm text-gray-500">등록된 플랫폼 코드가 없습니다.</div>
      )}

      <div className="divide-y divide-gray-200">
        {codes.map((code) =>
          editingId === code.id ? (
            <div key={code.id}>{inlineForm(() => handleUpdate(code.id))}</div>
          ) : (
            <div
              key={code.id}
              className="grid grid-cols-[1fr_1fr_auto] items-center gap-2 py-2 text-sm text-gray-700"
            >
              <span>{platformLabel(code.platform)}</span>
              <span>{code.deliveryCompanyCode}</span>
              <span className="text-right space-x-2">
                <button
                  type="button"
                  onClick={() => openEdit(code)}
                  className="px-3 py-1 border border-gray-300 rounded text-sm text-gray-700 hover:bg-gray-100 transition-colors"
                >
                  수정
                </button>
                <button
                  type="button"
                  onClick={() => handleDelete(code)}
                  className="px-3 py-1 border border-red-300 rounded text-sm text-red-600 hover:bg-red-50 transition-colors"
                >
                  삭제
                </button>
              </span>
            </div>
          ),
        )}
      </div>

      {isAdding ? (
        inlineForm(handleCreate)
      ) : (
        <button
          type="button"
          onClick={openAdd}
          className="mt-2 px-3 py-1 text-sm text-blue-600 hover:text-blue-700 transition-colors"
        >
          + 코드 추가
        </button>
      )}
    </div>
  );
}
