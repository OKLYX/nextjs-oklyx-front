'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { PageContainer } from '@/presentation/components/PageContainer';
import { Spinner } from '@/presentation/components/Spinner';
import { useAuthStore } from '@/infrastructure/stores/authStore';
import { MarginPolicyUseCase } from '@/application/usecases/MarginPolicyUseCase';
import { MarginPolicyRepositoryImpl } from '@/infrastructure/repositories/MarginPolicyRepositoryImpl';
import { SellerUseCase } from '@/application/usecases/SellerUseCase';
import { SellerRepositoryImpl } from '@/infrastructure/repositories/SellerRepositoryImpl';
import { PLATFORMS } from '@/config/platforms';
import type { MarginPolicyResponse } from '@/domain/entities/MarginPolicyEntity';
import type { Seller } from '@/domain/entities/SellerEntity';
import { Button } from '@/presentation/components/ui/Button';
import { Input } from '@/presentation/components/ui/Input';

// marginRate is a 0~1 decimal on the backend; the UI works in whole percents.
// Round-trips (0.15 -> 15% -> 0.15) are guarded against float error.
const toPercent = (rate: number) => Math.round(rate * 10000) / 100;
const toRate = (pct: number) => Math.round(pct * 100) / 10000;

/**
 * 마진 프리셋(판매자 × 플랫폼) CRUD 화면.
 * File: src/app/dashboard/margin-policies/components/MarginPolicyTable.tsx
 */
export function MarginPolicyTable() {
  const user = useAuthStore((state) => state.user);
  const isAdmin = user?.role === 'ADMIN';

  const useCase = useMemo(() => new MarginPolicyUseCase(new MarginPolicyRepositoryImpl()), []);
  const sellerUseCase = useMemo(() => new SellerUseCase(new SellerRepositoryImpl()), []);

  const [policies, setPolicies] = useState<MarginPolicyResponse[]>([]);
  const [sellers, setSellers] = useState<Seller[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  // Inline form state (create when editingId === null, edit otherwise).
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formSellerId, setFormSellerId] = useState<number | ''>('');
  const [formPlatform, setFormPlatform] = useState('');
  const [formPct, setFormPct] = useState('');
  // 표시 할인율은 0~0.5 decimal 로 그대로 입력 (originalPrice 역산은 백엔드).
  const [formDiscount, setFormDiscount] = useState('');
  // 최소 마진 기준 (FEATURE_2609_39 / PLAN D4). 빈 문자열 = 미사용 → 저장 시 null.
  const [formMinAmount, setFormMinAmount] = useState('');
  const [formMinPct, setFormMinPct] = useState('');
  const [formError, setFormError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);

  const load = useCallback(async () => {
    const list = await useCase.list();
    setPolicies(list);
  }, [useCase]);

  useEffect(() => {
    if (!isAdmin) return;
    let alive = true;
    (async () => {
      setIsLoading(true);
      setError('');
      try {
        const [list, sellerList] = await Promise.all([useCase.list(), sellerUseCase.getAll()]);
        if (!alive) return;
        setPolicies(list);
        setSellers(sellerList);
      } catch {
        if (alive) setError('마진 프리셋을 불러오지 못했습니다.');
      } finally {
        if (alive) setIsLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [useCase, sellerUseCase, isAdmin]);

  const sellerName = (id: number) => sellers.find((s) => s.id === id)?.sellerName ?? `#${id}`;

  const openCreate = () => {
    setEditingId(null);
    setFormSellerId('');
    setFormPlatform('');
    setFormPct('');
    setFormDiscount('');
    setFormMinAmount('');
    setFormMinPct('');
    setFormError('');
    setShowForm(true);
  };

  const openEdit = (p: MarginPolicyResponse) => {
    setEditingId(p.id);
    setFormSellerId(p.sellerId);
    setFormPlatform(p.platform);
    setFormPct(String(toPercent(p.marginRate)));
    setFormDiscount(p.displayDiscountRate != null ? String(p.displayDiscountRate) : '');
    setFormMinAmount(p.minMarginAmount != null ? String(p.minMarginAmount) : '');
    setFormMinPct(p.minMarginRate != null ? String(toPercent(p.minMarginRate)) : '');
    setFormError('');
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    setFormError('');
  };

  const handleSubmit = async () => {
    setFormError('');
    if (formSellerId === '') {
      setFormError('판매자를 선택하세요.');
      return;
    }
    if (!formPlatform) {
      setFormError('플랫폼을 선택하세요.');
      return;
    }
    const pct = Number(formPct);
    if (formPct === '' || Number.isNaN(pct) || pct < 0 || pct > 100) {
      setFormError('마진율은 0~100 사이의 숫자여야 합니다.');
      return;
    }
    let discount: number | undefined;
    if (formDiscount !== '') {
      const d = Number(formDiscount);
      if (Number.isNaN(d) || d < 0 || d > 0.5) {
        setFormError('표시 할인율은 0~0.5 사이의 숫자여야 합니다.');
        return;
      }
      discount = d;
    }
    // 빈칸 = 그 조건 미사용 → null 을 명시 전송해야 기존 값이 지워진다(undefined 는 백엔드가 무시하지 않고
    // 그대로 null 로 쓰지만, 의도를 코드에 남긴다).
    let minAmount: number | null = null;
    if (formMinAmount !== '') {
      const a = Number(formMinAmount);
      if (Number.isNaN(a) || a < 0) {
        setFormError('최소 마진액은 0 이상의 숫자여야 합니다.');
        return;
      }
      minAmount = a;
    }
    let minRate: number | null = null;
    if (formMinPct !== '') {
      const r = Number(formMinPct);
      if (Number.isNaN(r) || r < 0 || r > 100) {
        setFormError('최소 마진율은 0~100 사이의 숫자여야 합니다.');
        return;
      }
      minRate = toRate(r);
    }
    const payload = {
      sellerId: formSellerId,
      platform: formPlatform,
      marginRate: toRate(pct),
      displayDiscountRate: discount,
      minMarginAmount: minAmount,
      minMarginRate: minRate,
    };
    setIsSubmitting(true);
    try {
      if (editingId == null) await useCase.create(payload);
      else await useCase.update(editingId, payload);
      await load();
      closeForm();
    } catch (e: unknown) {
      const status = (e as { response?: { status?: number } })?.response?.status;
      setFormError(
        status === 400
          ? '이미 존재하는 판매자·플랫폼 조합입니다.'
          : '저장에 실패했습니다.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (p: MarginPolicyResponse) => {
    if (!confirm(`${sellerName(p.sellerId)} / ${p.platform} 프리셋을 삭제하시겠습니까?`)) return;
    setError('');
    setBusyId(p.id);
    try {
      await useCase.remove(p.id);
      await load();
    } catch {
      setError('삭제에 실패했습니다.');
    } finally {
      setBusyId(null);
    }
  };

  if (!isAdmin) {
    return (
      <PageContainer>
        <p className="text-sm text-gray-500">접근 권한이 없습니다.</p>
      </PageContainer>
    );
  }

  return (
    <PageContainer
      title="마진 프리셋"
      action={
        <Button
          type="button"
          onClick={openCreate}
        >
          새 프리셋
        </Button>
      }
    >
      {showForm && (
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <h2 className="mb-3 text-sm font-semibold text-gray-900">
            {editingId == null ? '새 프리셋' : '프리셋 수정'}
          </h2>
          {formError && (
            <p className="mb-3 rounded bg-red-50 px-3 py-2 text-sm text-red-700">{formError}</p>
          )}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">판매자</label>
              <select
                className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm text-gray-900"
                value={formSellerId}
                onChange={(e) => setFormSellerId(e.target.value ? Number(e.target.value) : '')}
              >
                <option value="">판매자 선택</option>
                {sellers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.sellerName}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">플랫폼</label>
              <select
                className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm text-gray-900"
                value={formPlatform}
                onChange={(e) => setFormPlatform(e.target.value)}
              >
                <option value="">플랫폼 선택</option>
                {PLATFORMS.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">목표 마진율 (%)</label>
              <Input
                type="number"
                min={0}
                max={100}
                step={0.1}
                size="sm"
                value={formPct}
                onChange={(e) => setFormPct(e.target.value)}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">표시 할인율 (0~0.5)</label>
              <Input
                type="number"
                min={0}
                max={0.5}
                step={0.01}
                placeholder="0 = 할인 없음"
                size="sm"
                value={formDiscount}
                onChange={(e) => setFormDiscount(e.target.value)}
              />
            </div>
          </div>
          <p className="mt-2 text-xs text-gray-500">
            originalPrice를 이 할인율로 역산해 표시가로 노출합니다. 실판매가·마진은 변하지 않습니다.
          </p>

          {/* 최소 마진 기준 (FEATURE_2609_39 / PLAN D4) — 목표 마진율과 축이 다르므로 한 묶음으로 분리해 둔다. */}
          <div className="mt-4 rounded border border-gray-200 bg-gray-50 p-3">
            <h3 className="mb-2 text-xs font-semibold text-gray-700">최소 마진 기준</h3>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600">최소 마진액 (원)</label>
                <Input
                  type="number"
                  min={0}
                  step={100}
                  placeholder="비우면 사용 안 함"
                  size="sm"
                  value={formMinAmount}
                  onChange={(e) => setFormMinAmount(e.target.value)}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600">최소 마진율 (%)</label>
                <Input
                  type="number"
                  min={0}
                  max={100}
                  step={0.1}
                  placeholder="비우면 사용 안 함"
                  size="sm"
                  value={formMinPct}
                  onChange={(e) => setFormMinPct(e.target.value)}
                />
              </div>
            </div>
            <p className="mt-2 text-xs text-gray-500">
              둘 중 하나라도 밑돌면 대응 필요로 표시됩니다. 비워두면 이 판매자·채널은 경고하지 않습니다.
            </p>
          </div>
          <div className="mt-4 flex gap-2">
            <button
              type="button"
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {isSubmitting ? <Spinner label="저장 중..." /> : '저장'}
            </button>
            <button
              type="button"
              onClick={closeForm}
              disabled={isSubmitting}
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 disabled:opacity-50"
            >
              취소
            </button>
          </div>
        </div>
      )}

      {error && <p className="rounded bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      <div className="rounded-lg bg-white shadow list-table-scroll">
        {isLoading ? (
          <div className="flex min-h-32 items-center justify-center">
            <Spinner size={24} label="불러오는 중..." />
          </div>
        ) : (
          <table>
            <thead className="bg-gray-100 border-b border-gray-200">
              <tr className="text-left text-sm text-gray-600">
                <th className="px-4 py-3">판매자</th>
                <th className="px-4 py-3">플랫폼</th>
                <th className="px-4 py-3">목표 마진율</th>
                <th className="px-4 py-3">표시 할인율</th>
                <th className="px-4 py-3">최소 마진액</th>
                <th className="px-4 py-3">최소 마진율</th>
                <th className="px-4 py-3">액션</th>
              </tr>
            </thead>
            <tbody>
              {policies.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-6 text-center text-sm text-gray-500">
                    등록된 마진 프리셋이 없습니다.
                  </td>
                </tr>
              ) : (
                policies.map((p) => (
                  <tr key={p.id} className="border-b border-gray-100 text-sm text-gray-900">
                    <td className="px-4 py-3">{p.sellerName || sellerName(p.sellerId)}</td>
                    <td className="px-4 py-3">{p.platform}</td>
                    <td className="px-4 py-3">{toPercent(p.marginRate)}%</td>
                    <td className="px-4 py-3">
                      {p.displayDiscountRate != null && p.displayDiscountRate > 0
                        ? p.displayDiscountRate
                        : '-'}
                    </td>
                    <td className="px-4 py-3">
                      {p.minMarginAmount != null
                        ? `${p.minMarginAmount.toLocaleString('ko-KR')}원`
                        : '—'}
                    </td>
                    <td className="px-4 py-3">
                      {p.minMarginRate != null ? `${toPercent(p.minMarginRate)}%` : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => openEdit(p)}
                          disabled={busyId === p.id}
                          className="rounded border border-blue-300 px-2 py-1 text-xs font-medium text-blue-600 hover:bg-blue-50 disabled:opacity-50"
                        >
                          수정
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(p)}
                          disabled={busyId === p.id}
                          className="rounded border border-red-300 px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
                        >
                          삭제
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        )}
      </div>
    </PageContainer>
  );
}
