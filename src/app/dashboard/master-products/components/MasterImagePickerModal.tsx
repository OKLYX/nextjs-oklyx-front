'use client';

import { useState } from 'react';

/**
 * 이미지 풀에서 한 필드(상세 zone 또는 대표사진)에 매핑할 이미지를 고르는 팝업.
 * File: src/app/dashboard/master-products/components/MasterImagePickerModal.tsx
 *
 * Hand-rolled `fixed inset-0` modal (shadcn 미도입, AssetPickerModal 스타일).
 * 풀 이미지 그리드에서 다중 체크(zone 필드) 또는 단일 라디오(대표사진 필드) 선택 후
 * 확인하면 그 필드의 매핑 토큰 배열을 반환한다.
 *
 * ⚠️ `token` = 이미지 식별자(수정 모드 = 이미지 id, 생성 모드 = 파일 인덱스).
 * ⚠️ url 은 이미 완성 URL(수정) 또는 objectURL(생성) → <img src> 직접 사용.
 * ⚠️ `single=true`(대표사진)면 마지막 선택 1개만 유지.
 *
 * 사용 예제:
 *   {pickerField && (
 *     <MasterImagePickerModal
 *       key={pickerField.key}                // remount per field → fresh selection
 *       fieldLabel={pickerField.label}
 *       single={pickerField.key === SOURCE_ZONE}
 *       images={poolEntries}
 *       initialSelected={mappedTokens}
 *       onConfirm={(tokens) => commitMapping(pickerField.key, tokens)}
 *       onClose={() => setPickerField(null)}
 *     />
 *   )}
 *
 * ⚠️ Mount only while picking and key by field, so the working selection is seeded
 * once from `initialSelected` (no reset effect needed).
 */
export interface PickerImage {
  token: number;
  url: string;
}

interface MasterImagePickerModalProps {
  fieldLabel: string;
  single: boolean;
  images: PickerImage[];
  initialSelected: number[];
  onConfirm: (tokens: number[]) => void;
  onClose: () => void;
}

export function MasterImagePickerModal({
  fieldLabel,
  single,
  images,
  initialSelected,
  onConfirm,
  onClose,
}: MasterImagePickerModalProps) {
  const [selected, setSelected] = useState<number[]>(initialSelected);

  const toggle = (token: number) => {
    if (single) {
      setSelected((prev) => (prev[0] === token ? [] : [token]));
      return;
    }
    setSelected((prev) =>
      prev.includes(token) ? prev.filter((t) => t !== token) : [...prev, token],
    );
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4">
      <div className="flex max-h-[85vh] w-full max-w-2xl flex-col rounded-lg bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-gray-200 px-5 py-3">
          <h3 className="text-base font-semibold text-gray-900">
            {fieldLabel} 이미지 선택 {single ? '(단일)' : '(다중)'}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded px-2 py-1 text-sm text-gray-500 hover:bg-gray-100"
          >
            닫기
          </button>
        </div>

        <div className="min-h-40 flex-1 overflow-y-auto p-5">
          {images.length === 0 ? (
            <p className="py-8 text-center text-sm text-gray-500">
              풀에 이미지가 없습니다. 먼저 이미지를 업로드하세요.
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
              {images.map((img) => {
                const isChecked = selected.includes(img.token);
                return (
                  <button
                    key={img.token}
                    type="button"
                    onClick={() => toggle(img.token)}
                    className={`relative rounded-lg border-2 p-1 ${
                      isChecked ? 'border-blue-500' : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="aspect-square overflow-hidden rounded bg-gray-100">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={img.url} alt="풀 이미지" className="h-full w-full object-contain" />
                    </div>
                    {isChecked && (
                      <span className="absolute right-2 top-2 flex h-5 w-5 items-center justify-center rounded-full bg-blue-600 text-[11px] text-white">
                        ✓
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 border-t border-gray-200 px-5 py-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-100"
          >
            취소
          </button>
          <button
            type="button"
            onClick={() => onConfirm(selected)}
            className="rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
          >
            확인
          </button>
        </div>
      </div>
    </div>
  );
}
