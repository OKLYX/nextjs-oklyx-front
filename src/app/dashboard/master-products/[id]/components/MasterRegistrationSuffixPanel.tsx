'use client';

import { useEffect, useState } from 'react';
import { Spinner } from '@/presentation/components/Spinner';
import { OptionCheckSuffixControl } from '@/presentation/components/OptionCheckSuffixControl';
import type { OptionCheckSuffixConfig } from '@/domain/entities/OptionCheckSuffix';
import type { MasterProductUseCase } from '@/application/usecases/MasterProductUseCase';

interface MasterRegistrationSuffixPanelProps {
  masterId: number;
  useCase: MasterProductUseCase; // owned by parent container (CoverageMatrix)
  onSaved: () => void; // matrix reload → registration-name sub-rows pick up the new suffix
}

/**
 * 마스터 등록상품명 "옵션확인" 접미사 override 편집 패널 (마스터 상세).
 * File: src/app/dashboard/master-products/[id]/components/MasterRegistrationSuffixPanel.tsx
 *
 * 해석 순서 = 채널 override ?? 마스터 override ?? 판매자 기본 ?? 시스템(옵션확인).
 * 이 패널은 **마스터 override** 만 편집한다(공통 OptionCheckSuffixControl 재사용).
 * 저장 성공 후 onSaved(매트릭스 재조회)로 등록상품명 sub-row(읽기전용, 68)가 새 접미사로 갱신된다.
 * 판매자/채널 편집은 별도 화면 → 그 변경은 매트릭스 다음 로드시 반영(즉시 재조회 대상 아님).
 */
export function MasterRegistrationSuffixPanel({
  masterId,
  useCase,
  onSaved,
}: MasterRegistrationSuffixPanelProps) {
  const [config, setConfig] = useState<OptionCheckSuffixConfig>({
    optionCheckSuffixEnabled: null,
    optionCheckSuffix: null,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      setIsLoading(true);
      setError('');
      try {
        const master = await useCase.getById(masterId);
        if (!alive) return;
        setConfig({
          optionCheckSuffixEnabled: master.optionCheckSuffixEnabled ?? null,
          optionCheckSuffix: master.optionCheckSuffix ?? null,
        });
      } catch {
        if (alive) setError('추가 문구를 불러오지 못했습니다.');
      } finally {
        if (alive) setIsLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [useCase, masterId]);

  const handleSave = async () => {
    try {
      setIsSaving(true);
      setError('');
      setSaved(false);
      await useCase.updateRegistrationNameSuffix(masterId, {
        enabled: config.optionCheckSuffixEnabled,
        suffix: config.optionCheckSuffix,
      });
      setSaved(true);
      // Transient confirmation — auto-dismiss (project has no toast system).
      setTimeout(() => setSaved(false), 2500);
      onSaved();
    } catch {
      setError('추가 문구 저장에 실패했습니다.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="rounded-lg bg-white p-4 shadow">
      <h2 className="mb-3 text-sm font-semibold text-gray-900">등록상품명 추가 문구</h2>

      {error && <p className="mb-3 rounded bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      {isLoading ? (
        <div className="flex min-h-16 items-center justify-center">
          <Spinner size={20} label="불러오는 중..." />
        </div>
      ) : (
        <div className="space-y-3">
          <OptionCheckSuffixControl
            value={config}
            onChange={(next) => {
              setConfig(next);
              setSaved(false);
            }}
            inheritedHint="채널/판매자 설정을 사용합니다."
            disabled={isSaving}
          />

          {saved && !error && (
            <p className="text-sm text-green-700">추가 문구를 저장했습니다.</p>
          )}

          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving}
            className="px-3 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 disabled:bg-blue-400 disabled:cursor-not-allowed transition-colors inline-flex items-center gap-2"
          >
            {isSaving ? <Spinner label="저장 중..." /> : '저장'}
          </button>
        </div>
      )}
    </div>
  );
}
