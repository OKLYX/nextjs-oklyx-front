'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Spinner } from '@/presentation/components/Spinner';
import { SOURCE_ZONE, type MasterPoolImage } from '@/domain/entities/DetailTemplateEntity';
import type { DetailContentUseCase } from '@/application/usecases/DetailContentUseCase';
import { MasterImagePickerModal, type PickerImage } from './MasterImagePickerModal';

/**
 * 마스터 이미지 풀 + 필드(상세 zone + 대표사진) 매핑 공통 UI.
 * File: src/app/dashboard/master-products/components/MasterImagePool.tsx
 *
 * **용도**: 마스터 폼(생성/수정)과 상세 편집기 tab2 에서 재사용하는 이미지 입력.
 *   업로드는 무조건 풀에 먼저 → 풀 이미지를 필드에 드래그하거나 [선택] 팝업으로 매핑.
 *   한 풀 이미지를 여러 zone + 대표사진에 동시 매핑(M:N 재사용).
 *
 * **필수 규칙**:
 *   - 필드 직접 업로드 <input> 을 만들지 말 것(업로드=풀 전용).
 *   - `imageUrl`(수정 모드) 은 완성 URL → <img src> 직접 사용(resolveThumbUrl 금지).
 *   - 대표사진 예약키 = `SOURCE_ZONE`(단일). zone 필드 = 다중.
 *   - `fields` 는 부모가 도출해 주입(대표사진 첫 필드 + imageZone 필드).
 *
 * **모드**:
 *   - 수정(`masterId != null`): 매핑 변경이 즉시 서버 반영(setZoneImages/setSourceImage) 후 재조회.
 *   - 생성(`masterId == null`): 서버 호출 없이 버퍼(`buffer`/`onBufferChange`)만 갱신 →
 *     부모가 create 후 순차 업로드 + 매핑.
 *
 * ⚠️ zone 내 이미지 순서변경(드래그 정렬)은 out-of-scope — 선택/드롭 + 개별 해제만.
 */
export type ImageField = { key: string; label: string };

export type MasterImageBuffer = {
  files: File[]; // upload queue (order = pool sortOrder)
  assignments: Record<string, number[]>; // fieldKey → file-index array (source ≤ 1)
};

// A pool entry unified across modes. `token` = image id (edit) or file index (create).
type PoolEntry = { token: number; url: string };

interface MasterImagePoolProps {
  masterId: number | null;
  detailUseCase: DetailContentUseCase;
  fields: ImageField[];
  // Create mode only: parent holds the buffer as the single source of truth.
  buffer?: MasterImageBuffer;
  onBufferChange?: (next: MasterImageBuffer) => void;
  // Edit mode: notify the parent a mapping changed (detail editor tab2 → zoneDirty).
  onDirty?: () => void;
}

export function MasterImagePool({
  masterId,
  detailUseCase,
  fields,
  buffer,
  onBufferChange,
  onDirty,
}: MasterImagePoolProps) {
  const isEdit = masterId != null;

  // ---- Edit-mode server state ----
  const [pool, setPool] = useState<MasterPoolImage[]>([]);
  const [isLoading, setIsLoading] = useState(isEdit);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const reload = useCallback(async () => {
    if (masterId == null) return;
    const list = await detailUseCase.listPoolImages(masterId);
    setPool([...list].sort((a, b) => a.sortOrder - b.sortOrder));
  }, [detailUseCase, masterId]);

  useEffect(() => {
    if (masterId == null) return;
    let alive = true;
    (async () => {
      setIsLoading(true);
      setError('');
      try {
        const list = await detailUseCase.listPoolImages(masterId);
        if (alive) setPool([...list].sort((a, b) => a.sortOrder - b.sortOrder));
      } catch {
        if (alive) setError('이미지 풀을 불러오지 못했습니다.');
      } finally {
        if (alive) setIsLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [detailUseCase, masterId]);

  // ---- Create-mode object URL previews (revoked on change/unmount) ----
  const bufferFiles = buffer?.files;
  const previews = useMemo(
    () => (isEdit ? [] : (bufferFiles ?? []).map((f) => URL.createObjectURL(f))),
    [isEdit, bufferFiles],
  );
  useEffect(() => {
    return () => previews.forEach((u) => URL.revokeObjectURL(u));
  }, [previews]);

  // ---- Unified pool entries ----
  const entries: PoolEntry[] = useMemo(() => {
    if (isEdit) return pool.map((img) => ({ token: img.id, url: img.imageUrl }));
    return previews.map((url, index) => ({ token: index, url }));
  }, [isEdit, pool, previews]);

  const entryByToken = useMemo(() => {
    const map = new Map<number, PoolEntry>();
    for (const e of entries) map.set(e.token, e);
    return map;
  }, [entries]);

  // Tokens currently mapped to a field (in mapping order).
  const fieldTokens = useCallback(
    (fieldKey: string): number[] => {
      if (!isEdit) return buffer?.assignments[fieldKey] ?? [];
      if (fieldKey === SOURCE_ZONE) return pool.filter((i) => i.isSource).map((i) => i.id);
      return pool.filter((i) => i.assignedZones.includes(fieldKey)).map((i) => i.id);
    },
    [isEdit, buffer, pool],
  );

  // Field labels this token is used in (badges on the pool thumbnail).
  const badgesForToken = useCallback(
    (token: number): string[] =>
      fields.filter((f) => fieldTokens(f.key).includes(token)).map((f) => f.label),
    [fields, fieldTokens],
  );

  // ---- Commit a field's mapping (edit → server, create → buffer) ----
  const commit = useCallback(
    async (fieldKey: string, tokens: number[]) => {
      const isSource = fieldKey === SOURCE_ZONE;
      const capped = isSource ? tokens.slice(0, 1) : tokens;
      if (!isEdit) {
        onBufferChange?.({
          files: buffer?.files ?? [],
          assignments: { ...(buffer?.assignments ?? {}), [fieldKey]: capped },
        });
        return;
      }
      if (masterId == null) return;
      setError('');
      setBusy(true);
      try {
        if (isSource) await detailUseCase.setSourceImage(masterId, capped[0] ?? null);
        else await detailUseCase.setZoneImages(masterId, fieldKey, capped);
        await reload();
        onDirty?.();
      } catch {
        setError('매핑 변경에 실패했습니다.');
      } finally {
        setBusy(false);
      }
    },
    [isEdit, masterId, detailUseCase, reload, onDirty, onBufferChange, buffer],
  );

  const addToField = (fieldKey: string, token: number) => {
    if (fieldKey === SOURCE_ZONE) {
      void commit(fieldKey, [token]);
      return;
    }
    const current = fieldTokens(fieldKey);
    if (current.includes(token)) return; // dedup
    void commit(fieldKey, [...current, token]);
  };

  const removeFromField = (fieldKey: string, token: number) => {
    void commit(
      fieldKey,
      fieldTokens(fieldKey).filter((t) => t !== token),
    );
  };

  // ---- Upload into the pool ----
  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(e.target.files ?? []);
    e.target.value = '';
    if (selected.length === 0) return;
    if (!isEdit) {
      onBufferChange?.({
        files: [...(buffer?.files ?? []), ...selected],
        assignments: buffer?.assignments ?? {},
      });
      return;
    }
    if (masterId == null) return;
    setError('');
    setBusy(true);
    try {
      // Sequential await preserves pool sortOrder (backend = upload order).
      for (const file of selected) {
        await detailUseCase.uploadPoolImage(masterId, file);
      }
      await reload();
    } catch {
      setError('이미지 업로드에 실패했습니다.');
    } finally {
      setBusy(false);
    }
  };

  // ---- Remove a pool image (and, in edit mode, its mappings server-side) ----
  const handleRemovePoolImage = async (token: number) => {
    if (!isEdit) {
      // Drop the file and shift every assignment index past it.
      const nextFiles = (buffer?.files ?? []).filter((_, i) => i !== token);
      const nextAssignments: Record<string, number[]> = {};
      for (const [k, arr] of Object.entries(buffer?.assignments ?? {})) {
        nextAssignments[k] = arr.filter((t) => t !== token).map((t) => (t > token ? t - 1 : t));
      }
      onBufferChange?.({ files: nextFiles, assignments: nextAssignments });
      return;
    }
    if (masterId == null) return;
    setError('');
    setBusy(true);
    try {
      await detailUseCase.deletePoolImage(masterId, token);
      await reload();
      onDirty?.();
    } catch {
      setError('이미지 제거에 실패했습니다.');
    } finally {
      setBusy(false);
    }
  };

  // ---- Drag / drop ----
  const [dragOverField, setDragOverField] = useState<string | null>(null);
  const handleDrop = (fieldKey: string, e: React.DragEvent) => {
    e.preventDefault();
    setDragOverField(null);
    const raw = e.dataTransfer.getData('text/plain');
    if (raw === '') return;
    const token = Number(raw);
    if (Number.isNaN(token)) return;
    addToField(fieldKey, token);
  };

  // ---- [선택] picker ----
  const [pickerField, setPickerField] = useState<ImageField | null>(null);
  const pickerImages: PickerImage[] = entries.map((e) => ({ token: e.token, url: e.url }));

  if (isEdit && isLoading) {
    return (
      <div className="flex min-h-24 items-center justify-center rounded-lg border border-gray-200">
        <Spinner size={20} label="이미지 풀 불러오는 중..." />
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {error && <p className="rounded bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {/* ---- Left: image pool ---- */}
        <div className="rounded-lg border border-gray-200 p-3">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-medium text-gray-600">이미지 풀</span>
            <label className="cursor-pointer rounded border border-blue-300 px-2 py-1 text-xs font-medium text-blue-700 hover:bg-blue-50">
              이미지 업로드
              <input
                type="file"
                accept="image/jpeg,image/png"
                multiple
                onChange={handleUpload}
                disabled={busy}
                hidden
              />
            </label>
          </div>
          {entries.length === 0 ? (
            <p className="py-6 text-center text-xs text-gray-500">
              이미지를 업로드하면 여기에 쌓입니다. 오른쪽 필드로 드래그하거나 [선택]으로 매핑하세요.
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {entries.map((entry) => {
                const badges = badgesForToken(entry.token);
                return (
                  <div
                    key={entry.token}
                    draggable
                    onDragStart={(e) => e.dataTransfer.setData('text/plain', String(entry.token))}
                    className="cursor-grab rounded border border-gray-200 p-2 active:cursor-grabbing"
                  >
                    <div className="mb-1 aspect-square overflow-hidden rounded bg-gray-100">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={entry.url} alt="풀 이미지" className="h-full w-full object-contain" />
                    </div>
                    {badges.length > 0 && (
                      <div className="mb-1 flex flex-wrap gap-1">
                        {badges.map((b) => (
                          <span
                            key={b}
                            className="rounded bg-blue-100 px-1 py-0.5 text-[10px] text-blue-700"
                          >
                            {b}
                          </span>
                        ))}
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={() => handleRemovePoolImage(entry.token)}
                      disabled={busy}
                      className="w-full rounded border border-red-300 px-1.5 py-0.5 text-[11px] text-red-600 hover:bg-red-50 disabled:opacity-50"
                    >
                      풀에서 제거
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ---- Right: field drop zones ---- */}
        <div className="space-y-3">
          {fields.map((field) => {
            const tokens = fieldTokens(field.key);
            const isSource = field.key === SOURCE_ZONE;
            return (
              <div
                key={field.key}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOverField(field.key);
                }}
                onDragLeave={() => setDragOverField((f) => (f === field.key ? null : f))}
                onDrop={(e) => handleDrop(field.key, e)}
                className={`rounded-lg border p-3 ${
                  dragOverField === field.key
                    ? 'border-blue-400 bg-blue-50'
                    : 'border-gray-200'
                }`}
              >
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-xs font-medium text-gray-600">
                    {field.label}
                    {isSource && <span className="ml-1 text-gray-400">(단일)</span>}
                  </span>
                  <button
                    type="button"
                    onClick={() => setPickerField(field)}
                    disabled={busy}
                    className="rounded border border-gray-300 px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-100 disabled:opacity-50"
                  >
                    선택
                  </button>
                </div>
                {tokens.length === 0 ? (
                  <p className="py-3 text-center text-[11px] text-gray-400">
                    풀 이미지를 여기로 드래그하거나 [선택]으로 매핑하세요.
                  </p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {tokens.map((token) => {
                      const entry = entryByToken.get(token);
                      if (!entry) return null;
                      return (
                        <div
                          key={token}
                          className="relative h-16 w-16 overflow-hidden rounded border border-gray-200 bg-gray-100"
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={entry.url} alt="매핑 이미지" className="h-full w-full object-contain" />
                          <button
                            type="button"
                            onClick={() => removeFromField(field.key, token)}
                            disabled={busy}
                            aria-label="매핑 해제"
                            className="absolute right-0 top-0 flex h-4 w-4 items-center justify-center bg-red-600/90 text-[10px] text-white hover:bg-red-700 disabled:opacity-50"
                          >
                            ✕
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {pickerField && (
        <MasterImagePickerModal
          key={pickerField.key}
          fieldLabel={pickerField.label}
          single={pickerField.key === SOURCE_ZONE}
          images={pickerImages}
          initialSelected={fieldTokens(pickerField.key)}
          onConfirm={(tokens) => {
            void commit(pickerField.key, tokens);
            setPickerField(null);
          }}
          onClose={() => setPickerField(null)}
        />
      )}
    </div>
  );
}
