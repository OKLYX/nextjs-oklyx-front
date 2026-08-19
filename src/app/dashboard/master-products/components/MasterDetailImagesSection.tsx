'use client';

import { useEffect, useMemo, useState } from 'react';
import type { DetailContentUseCase } from '@/application/usecases/DetailContentUseCase';
import { ZoneImageManager } from '../[id]/detail/[listingId]/components/ZoneImageManager';

interface MasterDetailImagesSectionProps {
  masterId: number | null; // null = create mode (buffer), value = edit mode (immediate CRUD)
  detailUseCase: DetailContentUseCase;
  // Create mode only: buffered files kept by the parent (modal) → uploaded after create.
  pendingByZone: Record<string, File[]>;
  onPendingChange: (zoneId: string, files: File[]) => void;
  // Notify the parent which zones the default template requires (empty = skip image validation).
  onRequiredZonesChange?: (zoneIds: string[]) => void;
}

/**
 * 마스터 생성/수정 폼의 상세페이지 zone 이미지 입력 섹션.
 * File: src/app/dashboard/master-products/components/MasterDetailImagesSection.tsx
 *
 * zone 목록 = 기본 DetailTemplate 의 imageZone 블록 bind(하드코딩 금지, StructuredDataPane 규칙과 동일).
 * - 수정 모드(masterId != null): 기존 ZoneImageManager 재사용(즉시 서버 CRUD).
 * - 생성 모드(masterId == null): 로컬 버퍼링 → 부모가 create 후 zone 별 순차 업로드.
 * ⚠️ 템플릿 로드 실패는 폼을 막지 않음(부차 입력) → catch → [] 로 섹션 미표시.
 */
export function MasterDetailImagesSection({
  masterId,
  detailUseCase,
  pendingByZone,
  onPendingChange,
  onRequiredZonesChange,
}: MasterDetailImagesSectionProps) {
  const [zoneIds, setZoneIds] = useState<string[]>([]);

  useEffect(() => {
    let alive = true;
    (async () => {
      let zones: string[] = [];
      try {
        const templates = await detailUseCase.listTemplates();
        const def = templates.find((t) => t.isDefault);
        zones = (def?.blocks ?? [])
          .filter((b) => b.type === 'imageZone' && b.bind)
          .map((b) => b.bind as string);
      } catch {
        zones = [];
      }
      if (!alive) return;
      setZoneIds(zones);
      onRequiredZonesChange?.(zones);
    })();
    return () => {
      alive = false;
    };
  }, [detailUseCase, onRequiredZonesChange]);

  if (zoneIds.length === 0) return null;

  return (
    <div className="space-y-3">
      <label className="mb-1 block text-xs font-medium text-gray-600">
        상세페이지 이미지 (선택)
      </label>
      {zoneIds.map((zoneId) =>
        masterId != null ? (
          <ZoneImageManager
            key={zoneId}
            masterId={masterId}
            zoneId={zoneId}
            detailUseCase={detailUseCase}
            onDirty={() => {}}
          />
        ) : (
          <CreateModeZone
            key={zoneId}
            zoneId={zoneId}
            files={pendingByZone[zoneId] ?? []}
            onChange={(files) => onPendingChange(zoneId, files)}
          />
        ),
      )}
      <p className="text-[11px] text-gray-500">
        상세페이지 이미지는 마스터 공유입니다. 생성 시 넣은 이미지는 저장 후 업로드됩니다. 이후
        순서변경·추가는 셀 [상세 편집]에서 조정하세요.
      </p>
    </div>
  );
}

interface CreateModeZoneProps {
  zoneId: string;
  files: File[];
  onChange: (files: File[]) => void;
}

/**
 * 생성 모드 zone: 로컬 버퍼 UI(서버 호출 없음).
 * ⚠️ 재선택 = 기존 버퍼에 append(교체 아님) — <input> 은 재선택 시 이전 선택을 잃으므로 부모 버퍼에 누적.
 */
function CreateModeZone({ zoneId, files, onChange }: CreateModeZoneProps) {
  // Derive object URLs (no setState in effect); the effect only revokes them
  // when `files` changes or the zone unmounts.
  const previews = useMemo(() => files.map((f) => URL.createObjectURL(f)), [files]);

  useEffect(() => {
    return () => {
      previews.forEach((u) => URL.revokeObjectURL(u));
    };
  }, [previews]);

  const handleSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(e.target.files ?? []);
    e.target.value = '';
    if (selected.length === 0) return;
    onChange([...files, ...selected]);
  };

  const handleRemove = (index: number) => {
    onChange(files.filter((_, i) => i !== index));
  };

  return (
    <div className="rounded-lg border border-gray-200 p-3">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs font-medium text-gray-600">이미지 zone: {zoneId}</span>
        <input
          type="file"
          accept="image/jpeg,image/png"
          multiple
          onChange={handleSelect}
          className="text-xs text-gray-700"
        />
      </div>
      {files.length === 0 ? (
        <p className="text-xs text-gray-500">이 zone 에 넣을 이미지를 선택하세요.</p>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {files.map((file, index) => (
            <div key={`${file.name}-${index}`} className="rounded border border-gray-200 p-2">
              <div className="mb-2 aspect-square overflow-hidden rounded bg-gray-100">
                {previews[index] && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={previews[index]}
                    alt={`${zoneId} #${index + 1}`}
                    className="h-full w-full object-contain"
                  />
                )}
              </div>
              <button
                type="button"
                onClick={() => handleRemove(index)}
                className="w-full rounded border border-red-300 px-1.5 py-0.5 text-xs text-red-600 hover:bg-red-50"
              >
                제거
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
