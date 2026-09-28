'use client';

import { useEffect, useMemo, useState } from 'react';
import { OrderRepositoryImpl } from '@/infrastructure/repositories/OrderRepositoryImpl';
import { OrderUseCase } from '@/application/usecases/OrderUseCase';
import { useAuthStore } from '@/infrastructure/stores/authStore';
import { extractErrorMessage } from '@/infrastructure/utils/errorMessage';
import { PageContainer } from '@/presentation/components/PageContainer';
import { Card } from '@/presentation/components/ui/Card';
import { StateBlock } from '@/presentation/components/ui/StateBlock';
import { Input } from '@/presentation/components/ui/Input';
import { Button } from '@/presentation/components/ui/Button';
import { formatKstWallClock } from '@/infrastructure/utils/kstWallClock';

/**
 * 주문관리 설정 — 기본 예약 발송 시각(FEATURE_2609_75 / D4·D12). 테넌트당 1개, 한국시간.
 * 저장하면 [예약 발송] 입력칸의 기본값(다음 도래 시각)이 이 시각으로 바뀐다(05).
 */
export function OrderSettingsContainer() {
  const orderUseCase = useMemo(() => new OrderUseCase(new OrderRepositoryImpl()), []);
  const isAdmin = useAuthStore((s) => s.user?.role === 'ADMIN');
  const [time, setTime] = useState('');
  const [nextExecuteAt, setNextExecuteAt] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!isAdmin) return;
    let alive = true;
    void (async () => {
      try {
        const setting = await orderUseCase.getOrderSetting();
        if (!alive) return;
        setTime(setting.reservedShipmentTime);
        setNextExecuteAt(setting.nextExecuteAt);
      } catch (err) {
        if (alive) setError(extractErrorMessage(err, '설정을 불러오지 못했습니다.'));
      } finally {
        if (alive) setIsLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [isAdmin, orderUseCase]);

  const handleSave = async () => {
    try {
      setIsSaving(true);
      setError('');
      setSaved(false);
      const setting = await orderUseCase.updateOrderSetting(time);
      setTime(setting.reservedShipmentTime);
      setNextExecuteAt(setting.nextExecuteAt);
      setSaved(true);
    } catch (err) {
      setError(extractErrorMessage(err, '저장에 실패했습니다. 다시 시도해주세요.'));
    } finally {
      setIsSaving(false);
    }
  };

  if (!isAdmin) {
    return (
      <PageContainer title="주문관리 설정">
        <Card padded={false}>
          <StateBlock variant="empty" message="관리자만 설정할 수 있습니다." />
        </Card>
      </PageContainer>
    );
  }

  return (
    <PageContainer title="주문관리 설정">
      <Card title="예약 발송">
        {isLoading ? (
          <StateBlock variant="loading" message="불러오는 중..." />
        ) : (
          <div className="space-y-4">
            <Input
              type="time"
              label="기본 예약 발송 시각"
              value={time}
              onChange={(e) => { setTime(e.target.value); setSaved(false); }}
              hint="한국시간입니다. [예약 발송]을 누를 때 이 시각이 기본으로 채워집니다."
              className="w-40"
            />
            {nextExecuteAt && (
              <p className="text-sm text-gray-600">다음 기본 예약 시각: {formatKstWallClock(nextExecuteAt)}</p>
            )}
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-800 text-sm">{error}</div>
            )}
            {saved && <p className="text-sm text-green-700">저장했습니다.</p>}
            <div className="flex justify-end">
              <Button onClick={() => void handleSave()} disabled={time === ''} isLoading={isSaving} loadingText="저장 중...">
                저장
              </Button>
            </div>
          </div>
        )}
      </Card>
    </PageContainer>
  );
}
