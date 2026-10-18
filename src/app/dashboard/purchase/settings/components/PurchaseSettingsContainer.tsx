'use client';

import { useEffect, useMemo, useState } from 'react';
import { PurchaseSettingRepositoryImpl } from '@/infrastructure/repositories/PurchaseSettingRepositoryImpl';
import { PurchaseSettingUseCase } from '@/application/usecases/PurchaseSettingUseCase';
import { useAuthStore } from '@/infrastructure/stores/authStore';
import { usePurchaseSettingStore } from '@/infrastructure/stores/purchaseSettingStore';
import { extractErrorMessage } from '@/infrastructure/utils/errorMessage';
import { PageContainer } from '@/presentation/components/PageContainer';
import { Card } from '@/presentation/components/ui/Card';
import { StateBlock } from '@/presentation/components/ui/StateBlock';
import { Button } from '@/presentation/components/ui/Button';

/**
 * 「구매관리 설정」 — the stock link switch (FEATURE_2610_09 D65 · D69 · D71 · D72). One per tenant, ADMIN only.
 * Off: a check-in only records the purchase. On: it also adds to stock. Purchases made while off never go to stock.
 */
export function PurchaseSettingsContainer() {
  const purchaseSettingUseCase = useMemo(
    () => new PurchaseSettingUseCase(new PurchaseSettingRepositoryImpl()),
    []
  );
  const isAdmin = useAuthStore((s) => s.user?.role === 'ADMIN');
  const setStoreStockLinked = usePurchaseSettingStore((s) => s.setStockLinked);
  const [stockLinked, setStockLinked] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!isAdmin) return;
    let alive = true;
    void (async () => {
      try {
        const setting = await purchaseSettingUseCase.get();
        if (!alive) return;
        setStockLinked(setting.stockLinked);
      } catch (err) {
        if (alive) setError(extractErrorMessage(err, '설정을 불러오지 못했습니다.'));
      } finally {
        if (alive) setIsLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [isAdmin, purchaseSettingUseCase]);

  const handleSave = async () => {
    try {
      setIsSaving(true);
      setError('');
      setSaved(false);
      const setting = await purchaseSettingUseCase.update({ stockLinked });
      setStockLinked(setting.stockLinked);
      setStoreStockLinked(setting.stockLinked);
      setSaved(true);
    } catch (err) {
      setError(extractErrorMessage(err, '저장에 실패했습니다. 다시 시도해주세요.'));
    } finally {
      setIsSaving(false);
    }
  };

  if (!isAdmin) {
    return (
      <PageContainer title="구매관리 설정">
        <Card padded={false}>
          <StateBlock variant="empty" message="관리자만 설정할 수 있습니다." />
        </Card>
      </PageContainer>
    );
  }

  return (
    <PageContainer title="구매관리 설정">
      <Card title="재고 연동">
        {isLoading ? (
          <StateBlock variant="loading" message="불러오는 중..." />
        ) : (
          <div className="space-y-4">
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={stockLinked}
                onChange={(e) => { setStockLinked(e.target.checked); setSaved(false); }}
                className="h-4 w-4 accent-blue-600"
              />
              재고 연동
            </label>
            <p className="text-sm text-gray-600">
              끄면 입고는 매입 기록만 남기고 재고에 더하지 않습니다. 끈 동안의 매입은 나중에 켜도 재고로 넣지 않습니다.
            </p>
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-800 text-sm">{error}</div>
            )}
            {saved && <p className="text-sm text-green-700">저장했습니다.</p>}
            <div className="flex justify-end">
              <Button onClick={() => void handleSave()} isLoading={isSaving} loadingText="저장 중...">
                저장
              </Button>
            </div>
          </div>
        )}
      </Card>
    </PageContainer>
  );
}
