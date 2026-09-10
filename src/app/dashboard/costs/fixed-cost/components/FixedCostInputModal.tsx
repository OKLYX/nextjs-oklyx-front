'use client';

import { useEffect, useState } from 'react';
import { AlertCircle } from 'lucide-react';
import type {
  CreateFixedCostRequest,
  PlatformFixedCost,
  UpdateFixedCostRequest,
} from '@/domain/entities/FixedCost';
import { DEFAULT_THRESHOLD_AMOUNT } from '@/domain/entities/FixedCost';
import { platformLabel } from '@/domain/entities/Settlement';
import { extractErrorMessage } from '@/infrastructure/utils/errorMessage';

// 고정비 항목이 확인된 플랫폼만 둔다 — 실제 청구서를 본 뒤에 늘린다(PLAN 2609_33 "이번 범위 밖").
const PLATFORM_VALUES = ['COUPANG'];

interface FixedCostInputModalProps {
  /** null = 추가 · 값 = 그 항목 수정(플랫폼은 카탈로그의 축이라 수정 대상이 아니다). */
  item: PlatformFixedCost | null;
  isLoading: boolean;
  onClose: () => void;
  onCreate: (data: CreateFixedCostRequest) => Promise<void>;
  onUpdate: (id: number, data: UpdateFixedCostRequest) => Promise<void>;
}

/**
 * 고정비 카탈로그 항목 추가·수정 모달.
 *
 * 🔴 여기서 고친 금액·임계는 이 항목을 쓰는 <b>모든 채널</b>에 그대로 반영된다(D1) — 채널에 복사본이 없다.
 * 409/400 문구는 서버가 준 것을 그대로 보여준다(프론트가 문구를 만들지 않는다).
 *
 * ⚠️ 입력 초기화는 <b>부모의 조건부 렌더(열 때마다 새 마운트)</b>가 담당한다 — 이펙트로 폼을 리셋하면
 * 프로젝트 lint(`react-hooks/set-state-in-effect`)에 걸린다.
 */
export function FixedCostInputModal({
  item,
  isLoading,
  onClose,
  onCreate,
  onUpdate,
}: FixedCostInputModalProps) {
  const isEdit = item !== null;
  const [platform, setPlatform] = useState(item?.platform ?? PLATFORM_VALUES[0]);
  const [name, setName] = useState(item?.name ?? '');
  const [amount, setAmount] = useState(item != null ? String(item.amount) : '');
  const [threshold, setThreshold] = useState(
    item != null ? String(item.thresholdAmount) : String(DEFAULT_THRESHOLD_AMOUNT)
  );
  const [active, setActive] = useState(item?.active ?? true);
  const [error, setError] = useState('');

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isLoading) onClose();
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [isLoading, onClose]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLoading) return;
    setError('');

    const amountValue = Number(amount);
    const thresholdValue = Number(threshold);
    if (!name.trim()) {
      setError('항목명을 입력하세요.');
      return;
    }
    if (!Number.isFinite(amountValue) || amountValue < 0) {
      setError('월 금액은 0 이상 숫자여야 합니다.');
      return;
    }
    if (!Number.isFinite(thresholdValue) || thresholdValue < 0) {
      setError('부과 임계는 0 이상 숫자여야 합니다.');
      return;
    }

    try {
      if (item) {
        await onUpdate(item.id, {
          name: name.trim(),
          amount: amountValue,
          thresholdAmount: thresholdValue,
          active,
        });
      } else {
        await onCreate({
          platform,
          name: name.trim(),
          amount: amountValue,
          thresholdAmount: thresholdValue,
        });
      }
    } catch (err) {
      setError(extractErrorMessage(err, '고정비 항목 저장에 실패했습니다.'));
    }
  };

  const inputCls =
    'w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-lg shadow-lg max-w-md w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b px-6 py-4 flex justify-between items-center">
          <h2 className="text-lg font-semibold text-gray-900">
            {isEdit ? '고정비 항목 수정' : '고정비 항목 추가'}
          </h2>
          <button
            onClick={onClose}
            disabled={isLoading}
            className="text-gray-500 hover:text-gray-700 disabled:opacity-50"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="rounded-md bg-red-50 p-3 text-sm text-red-700 flex items-start gap-2">
              <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
              <div>{error}</div>
            </div>
          )}

          {!isEdit && (
            <div>
              <label htmlFor="fixedCostPlatform" className="block text-sm font-medium mb-1">
                플랫폼 <span className="text-red-600">*</span>
              </label>
              <select
                id="fixedCostPlatform"
                value={platform}
                onChange={(e) => setPlatform(e.target.value)}
                disabled={isLoading}
                className={`${inputCls} bg-white`}
              >
                {PLATFORM_VALUES.map((value) => (
                  <option key={value} value={value}>
                    {platformLabel(value)}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label htmlFor="fixedCostName" className="block text-sm font-medium mb-1">
              항목명 <span className="text-red-600">*</span>
            </label>
            <input
              id="fixedCostName"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="예: 판매자서비스이용료"
              disabled={isLoading}
              className={inputCls}
            />
          </div>

          <div>
            <label htmlFor="fixedCostAmount" className="block text-sm font-medium mb-1">
              월 금액 <span className="text-red-600">*</span>
            </label>
            <input
              id="fixedCostAmount"
              type="number"
              min={0}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="예: 55000"
              disabled={isLoading}
              className={inputCls}
            />
            <p className="mt-1 text-xs text-gray-500">부가세가 포함된 금액을 그대로 입력하세요.</p>
          </div>

          <div>
            <label htmlFor="fixedCostThreshold" className="block text-sm font-medium mb-1">
              부과 임계 <span className="text-red-600">*</span>
            </label>
            <input
              id="fixedCostThreshold"
              type="number"
              min={0}
              value={threshold}
              onChange={(e) => setThreshold(e.target.value)}
              disabled={isLoading}
              className={inputCls}
            />
            <p className="mt-1 text-xs text-gray-500">
              그 달 상품 매출(배송비 제외)이 임계 이상인 달에만 부과됩니다.
            </p>
          </div>

          {isEdit && (
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={active}
                onChange={(e) => setActive(e.target.checked)}
                disabled={isLoading}
                className="h-4 w-4"
              />
              사용
            </label>
          )}

          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isLoading}
              className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              취소
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="flex-1 px-3 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 disabled:bg-blue-400"
            >
              {isLoading ? '저장 중...' : '저장'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
