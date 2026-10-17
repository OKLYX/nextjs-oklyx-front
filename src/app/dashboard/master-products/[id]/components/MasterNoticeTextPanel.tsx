'use client';

import { useState } from 'react';
import { Spinner } from '@/presentation/components/Spinner';
import { extractErrorMessage } from '@/infrastructure/utils/errorMessage';
import type { MasterProductResponse } from '@/domain/entities/MasterProductEntity';
import type { MasterProductUseCase } from '@/application/usecases/MasterProductUseCase';
import { Button } from '@/presentation/components/ui/Button';
import {
  NOTICE_TEXT_FIELDS,
  NOTICE_TEXT_TOO_LONG_MESSAGE,
  noticeTextTooLong,
} from '@/domain/entities/ElevenstNoticeText';
import { lookupPlatformLabel, type LookupPlatform } from '../../components/platformCategory';

const NOTICE_TABS: LookupPlatform[] = ['COUPANG', 'ELEVENST'];
const DEFAULT_PLACEHOLDER = '판매채널 기본값 사용';

interface MasterNoticeTextPanelProps {
  master: MasterProductResponse; // values come from the parent (no getById here)
  useCase: MasterProductUseCase; // owned by parent container (CoverageMatrix)
  onSaved: (patched: MasterProductResponse) => void; // parent updates its master state in place
}

/**
 * Inline editor of the master's 「A/S 안내」 · 「반품/교환 안내」 texts (master detail, 「배송 설정」 tab).
 * File: src/app/dashboard/master-products/[id]/components/MasterNoticeTextPanel.tsx
 *
 * One tab per platform. Only 11st takes these texts (FEATURE_2610_13 / D74); the Coupang tab says so, so the user
 * does not wonder whether something was left out. A blank value falls back to the 11st sales channel default
 * (FEATURE_2610_16 / D5).
 *
 * ⚠️ The texts live in `master.fieldValues` next to the template field values, and the backend replaces the whole
 * map on save. So the save sends the master's current map with only the two notice keys edited — never the notice
 * keys alone (that would erase the template field values). A text over 4000 EUC-KR bytes stops the save (D78).
 */
export function MasterNoticeTextPanel({ master, useCase, onSaved }: MasterNoticeTextPanelProps) {
  const [tab, setTab] = useState<LookupPlatform>('ELEVENST');
  const [values, setValues] = useState<Record<string, string>>(master.fieldValues ?? {});
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);

  const startEdit = () => {
    setValues(master.fieldValues ?? {});
    setError('');
    setSaved(false);
    setIsEditing(true);
  };

  const handleSave = async () => {
    if (noticeTextTooLong(values)) {
      setError(NOTICE_TEXT_TOO_LONG_MESSAGE);
      return;
    }
    // Start from the saved map so the template field values are kept; blank values are omitted (= defaults).
    const merged: Record<string, string> = { ...(master.fieldValues ?? {}) };
    for (const f of NOTICE_TEXT_FIELDS) merged[f.key] = values[f.key] ?? '';
    const cleaned: Record<string, string> = {};
    for (const [k, v] of Object.entries(merged)) {
      if (v.trim() !== '') cleaned[k] = v;
    }
    try {
      setIsSaving(true);
      setError('');
      setSaved(false);
      const patched = await useCase.update(master.id, { fieldValues: cleaned });
      setIsEditing(false);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
      onSaved(patched);
    } catch (err) {
      setError(extractErrorMessage(err, '안내 문구 저장에 실패했습니다.'));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-3 p-4">
      <div className="flex gap-1 border-b border-gray-200">
        {NOTICE_TABS.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`-mb-px border-b-2 px-3 py-1.5 text-sm font-medium ${
              tab === t
                ? 'border-blue-600 text-blue-700'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {lookupPlatformLabel(t)}
          </button>
        ))}
      </div>

      {tab === 'COUPANG' ? (
        <p className="rounded bg-gray-50 px-3 py-3 text-sm text-gray-700">
          쿠팡은 A/S 안내 · 반품/교환 안내 문구를 받지 않습니다.
        </p>
      ) : (
        <>
          {error && <p className="rounded bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
          {NOTICE_TEXT_FIELDS.map((f) => (
            <div key={f.key}>
              <label className="mb-1 block text-xs font-medium text-gray-600">{f.label}</label>
              {isEditing ? (
                <textarea
                  rows={4}
                  value={values[f.key] ?? ''}
                  placeholder={DEFAULT_PLACEHOLDER}
                  disabled={isSaving}
                  onChange={(e) => {
                    const next = e.target.value;
                    setValues((prev) => ({ ...prev, [f.key]: next }));
                    setSaved(false);
                  }}
                  className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm text-gray-900 disabled:bg-gray-100"
                />
              ) : (
                <p className="whitespace-pre-wrap rounded bg-gray-50 px-3 py-2 text-sm text-gray-800">
                  {master.fieldValues?.[f.key]?.trim() ? (
                    master.fieldValues[f.key]
                  ) : (
                    <span className="text-gray-400">{DEFAULT_PLACEHOLDER}</span>
                  )}
                </p>
              )}
            </div>
          ))}

          <p className="text-[11px] text-gray-500">비우면 11번가 판매채널에 넣어 둔 기본 문구가 쓰입니다.</p>

          {saved && !error && <p className="text-sm text-green-700">안내 문구를 저장했습니다.</p>}

          {isEditing ? (
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                onClick={handleSave}
                disabled={isSaving}
                className="inline-flex items-center gap-2"
              >
                {isSaving ? <Spinner label="저장 중..." /> : '저장'}
              </Button>
              <button
                type="button"
                onClick={() => {
                  setIsEditing(false);
                  setError('');
                }}
                disabled={isSaving}
                className="px-3 py-2 border border-gray-300 text-gray-700 text-sm font-medium rounded-md hover:bg-gray-100 disabled:opacity-50 transition-colors"
              >
                취소
              </button>
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
        </>
      )}
    </div>
  );
}
