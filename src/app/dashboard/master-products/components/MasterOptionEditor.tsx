'use client';

import { useState } from 'react';
import { Spinner } from '@/presentation/components/Spinner';
import type { MasterProductUseCase } from '@/application/usecases/MasterProductUseCase';
import type {
  MasterProductResponse,
  MasterOptionResponse,
} from '@/domain/entities/MasterProductEntity';
import type { CarrierRate } from '@/domain/entities/CarrierRateEntity';
import type { Package } from '@/domain/entities/PackageEntity';

const formatWon = (v: number) => `${v.toLocaleString('ko-KR')}원`;

interface MasterOptionEditorProps {
  master: MasterProductResponse;
  useCase: MasterProductUseCase;
  carrierRates: CarrierRate[]; // owned by master list page, loaded once
  packages: Package[];
  onChanged: () => Promise<void> | void; // reload master + parent list
}

/**
 * 옵션 수량조합 편집 (핵심 비즈니스 로직).
 * File: src/app/dashboard/master-products/components/MasterOptionEditor.tsx
 *
 * 옵션 1줄 = 이름 + 마스터 구성상품 전체에 대한 수량 조합.
 * UI 가 항상 전체 구성상품 행을 보여주므로 부분집합(누락) 불가.
 */
export function MasterOptionEditor({
  master,
  useCase,
  carrierRates,
  packages,
  onChanged,
}: MasterOptionEditorProps) {
  const { components, options, id: masterId } = master;

  const [showForm, setShowForm] = useState(false);
  const [editingOptionId, setEditingOptionId] = useState<number | null>(null);
  const [optName, setOptName] = useState('');
  const [quantities, setQuantities] = useState<Record<number, string>>({});
  const [optDeliveryId, setOptDeliveryId] = useState<number | ''>('');
  const [optPackageId, setOptPackageId] = useState<number | ''>('');
  const [formError, setFormError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [busyOptionId, setBusyOptionId] = useState<number | null>(null);

  const openAdd = () => {
    setEditingOptionId(null);
    setOptName('');
    setQuantities(Object.fromEntries(components.map((c) => [c.productId, '1'])));
    setOptDeliveryId('');
    setOptPackageId('');
    setFormError('');
    setShowForm(true);
  };

  const openEdit = (opt: MasterOptionResponse) => {
    setEditingOptionId(opt.id);
    setOptName(opt.name);
    const byId = new Map(opt.items.map((it) => [it.productId, it.quantity]));
    setQuantities(
      Object.fromEntries(components.map((c) => [c.productId, String(byId.get(c.productId) ?? 1)]))
    );
    setOptDeliveryId(opt.deliveryId ?? '');
    setOptPackageId(opt.packageId ?? '');
    setFormError('');
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    setFormError('');
  };

  const handleSubmit = async () => {
    setFormError('');
    if (!optName.trim()) {
      setFormError('옵션 이름을 입력하세요.');
      return;
    }
    const items = components.map((c) => ({
      productId: c.productId,
      quantity: Number(quantities[c.productId]),
    }));
    if (items.some((it) => !Number.isInteger(it.quantity) || it.quantity < 1)) {
      setFormError('각 구성상품 수량은 1 이상이어야 합니다.');
      return;
    }
    setIsSubmitting(true);
    try {
      const payload = {
        name: optName.trim(),
        items,
        deliveryId: optDeliveryId === '' ? undefined : Number(optDeliveryId),
        packageId: optPackageId === '' ? undefined : Number(optPackageId),
      };
      if (editingOptionId == null) await useCase.addOption(masterId, payload);
      else await useCase.updateOption(masterId, editingOptionId, payload);
      await onChanged();
      closeForm();
    } catch (e: unknown) {
      const status = (e as { response?: { status?: number } })?.response?.status;
      setFormError(status === 400 ? '입력값을 확인하세요.' : '저장에 실패했습니다.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (opt: MasterOptionResponse) => {
    if (!confirm(`옵션 "${opt.name}" 을(를) 삭제하시겠습니까?`)) return;
    setBusyOptionId(opt.id);
    try {
      await useCase.deleteOption(masterId, opt.id);
      await onChanged();
    } catch {
      setFormError('옵션 삭제에 실패했습니다.');
    } finally {
      setBusyOptionId(null);
    }
  };

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-900">옵션 (수량조합)</h3>
        <button
          type="button"
          onClick={openAdd}
          className="rounded border border-blue-300 px-2 py-1 text-xs font-medium text-blue-600 hover:bg-blue-50"
        >
          옵션 추가
        </button>
      </div>

      {options.length === 0 ? (
        <p className="mb-3 text-sm text-gray-500">등록된 옵션이 없습니다.</p>
      ) : (
        <ul className="mb-3 space-y-2">
          {options.map((opt) => (
            <li
              key={opt.id}
              className="flex items-center justify-between rounded border border-gray-200 px-3 py-2 text-sm text-gray-900"
            >
              <span>
                <span className="font-medium">{opt.name}</span>{' '}
                <span className="text-gray-500">
                  ({opt.items.map((it) => `${it.productName}×${it.quantity}`).join(', ')})
                </span>
              </span>
              <span className="flex gap-2">
                <button
                  type="button"
                  onClick={() => openEdit(opt)}
                  disabled={busyOptionId === opt.id}
                  className="rounded border border-blue-300 px-2 py-0.5 text-xs font-medium text-blue-600 hover:bg-blue-50 disabled:opacity-50"
                >
                  수정
                </button>
                <button
                  type="button"
                  onClick={() => handleDelete(opt)}
                  disabled={busyOptionId === opt.id}
                  className="rounded border border-red-300 px-2 py-0.5 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
                >
                  삭제
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}

      {showForm && (
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
          <h4 className="mb-2 text-xs font-semibold text-gray-900">
            {editingOptionId == null ? '옵션 추가' : '옵션 수정'}
          </h4>
          {formError && (
            <p className="mb-2 rounded bg-red-50 px-3 py-1.5 text-sm text-red-700">{formError}</p>
          )}
          <div className="mb-3">
            <label className="mb-1 block text-xs font-medium text-gray-600">옵션 이름 *</label>
            <input
              className="w-full rounded border border-gray-300 px-2 py-1 text-sm text-gray-900"
              value={optName}
              onChange={(e) => setOptName(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            {components.map((c) => (
              <div key={c.productId} className="flex items-center gap-2">
                <span className="flex-1 text-sm text-gray-700">{c.productName}</span>
                <input
                  type="number"
                  min={1}
                  step={1}
                  className="w-24 rounded border border-gray-300 px-2 py-1 text-sm text-gray-900"
                  value={quantities[c.productId] ?? '1'}
                  onChange={(e) =>
                    setQuantities((prev) => ({ ...prev, [c.productId]: e.target.value }))
                  }
                />
              </div>
            ))}
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">택배 override</label>
              <select
                className="w-full rounded border border-gray-300 px-2 py-1 text-sm text-gray-900"
                value={optDeliveryId}
                onChange={(e) => setOptDeliveryId(e.target.value ? Number(e.target.value) : '')}
              >
                <option value="">기본값 사용</option>
                {carrierRates.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.carrier} {r.type} · {formatWon(r.cost)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">상자 override</label>
              <select
                className="w-full rounded border border-gray-300 px-2 py-1 text-sm text-gray-900"
                value={optPackageId}
                onChange={(e) => setOptPackageId(e.target.value ? Number(e.target.value) : '')}
              >
                <option value="">기본값 사용</option>
                {packages.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.type} · {formatWon(p.cost)}
                  </option>
                ))}
              </select>
            </div>
            <p className="col-span-2 text-[11px] text-gray-500">
              비우면 마스터 기본 택배/박스를 사용합니다.
            </p>
          </div>
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {isSubmitting ? <Spinner label="저장 중..." /> : '저장'}
            </button>
            <button
              type="button"
              onClick={closeForm}
              disabled={isSubmitting}
              className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-100 disabled:opacity-50"
            >
              취소
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
