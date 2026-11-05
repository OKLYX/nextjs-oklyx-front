'use client';

import { useEffect, useMemo, useState } from 'react';
import { ElevenstPhotoKeyRepositoryImpl } from '@/infrastructure/repositories/ElevenstPhotoKeyRepositoryImpl';
import { ElevenstPhotoKeyUseCase } from '@/application/usecases/ElevenstPhotoKeyUseCase';
import { useAuthStore } from '@/infrastructure/stores/authStore';
import { extractErrorMessage } from '@/infrastructure/utils/errorMessage';
import { PageContainer } from '@/presentation/components/PageContainer';
import { Card } from '@/presentation/components/ui/Card';
import { StateBlock } from '@/presentation/components/ui/StateBlock';
import { Button } from '@/presentation/components/ui/Button';

/**
 * 「11번가 사진 조회 키」 — the company's 11st OpenAPI key used by [마켓 기준으로 맞추기] to read 11st photos
 * (FEATURE_2611_11 / D39). One per tenant, ADMIN only. The key is never shown back — only whether one is stored.
 * Saving a blank value clears the key.
 */
export function ElevenstPhotoKeyContainer() {
  const photoKeyUseCase = useMemo(
    () => new ElevenstPhotoKeyUseCase(new ElevenstPhotoKeyRepositoryImpl()),
    []
  );
  const isAdmin = useAuthStore((s) => s.user?.role === 'ADMIN');
  // null = not known yet (loading or the load failed).
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [apiKey, setApiKey] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!isAdmin) return;
    let alive = true;
    void (async () => {
      try {
        const state = await photoKeyUseCase.get();
        if (!alive) return;
        setConfigured(state.configured);
      } catch (err) {
        if (alive) setError(extractErrorMessage(err, '설정을 불러오지 못했습니다.'));
      } finally {
        if (alive) setIsLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [isAdmin, photoKeyUseCase]);

  const handleSave = async () => {
    try {
      setIsSaving(true);
      setError('');
      setSaved(false);
      const state = await photoKeyUseCase.update({ apiKey: apiKey.trim() });
      setConfigured(state.configured);
      setApiKey('');
      setSaved(true);
    } catch (err) {
      setError(extractErrorMessage(err, '저장에 실패했습니다. 다시 시도해주세요.'));
    } finally {
      setIsSaving(false);
    }
  };

  if (!isAdmin) {
    return (
      <PageContainer title="11번가 사진 조회 키">
        <Card padded={false}>
          <StateBlock variant="empty" message="관리자만 설정할 수 있습니다." />
        </Card>
      </PageContainer>
    );
  }

  return (
    <PageContainer title="11번가 사진 조회 키">
      <Card title="11번가 사진 조회 키">
        {isLoading ? (
          <StateBlock variant="loading" message="불러오는 중..." />
        ) : (
          <div className="space-y-4">
            {configured != null && (
              <p className="text-sm text-gray-700">
                지금 상태: <span className="font-medium text-gray-900">{configured ? '입력됨' : '비어 있음'}</span>
              </p>
            )}
            <input
              type="password"
              autoComplete="off"
              value={apiKey}
              onChange={(e) => { setApiKey(e.target.value); setSaved(false); }}
              placeholder="11번가 OpenAPI 키"
              disabled={isSaving}
              className="w-full rounded border border-gray-300 px-3 py-2 text-sm text-gray-900 disabled:opacity-50"
            />
            <div className="space-y-1 text-sm text-gray-600">
              <p>
                11번가 판매상품의 [마켓 기준으로 맞추기]가 사진을 읽을 때 씁니다. 회사의 모든 11번가 판매채널이 함께 씁니다.
              </p>
              <p>빈 칸으로 저장하면 키를 지웁니다.</p>
            </div>
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
