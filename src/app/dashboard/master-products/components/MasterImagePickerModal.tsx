'use client';

import { useState } from 'react';
import { Modal } from '@/presentation/components/ui/Modal';

/**
 * Popup that picks the pool images to map to one field (detail zone · cover photo · thumbnail template group).
 * File: src/app/dashboard/master-products/components/MasterImagePickerModal.tsx
 *
 * Built on `ui/Modal`. In the pool image grid you tick many (multi-image field) or one (a `single` field —
 * cover photo · thumbnail template group), and confirming returns that field's mapping token array.
 *
 * ⚠️ `token` = image identifier (edit mode = image id, create mode = file index).
 * ⚠️ url is already a complete URL (edit) or an objectURL (create) → use it in <img src> directly.
 * ⚠️ With `single=true` only the last pick is kept.
 *
 * Usage example:
 *   {pickerField && (
 *     <MasterImagePickerModal
 *       key={pickerField.key}                // remount per field → fresh selection
 *       fieldLabel={pickerField.label}
 *       single={pickerField.single === true}
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
    <Modal
      isOpen
      onClose={onClose}
      title={`${fieldLabel} 이미지 선택 ${single ? '(단일)' : '(다중)'}`}
    >
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

      <div className="flex justify-end gap-2 border-t border-gray-200 px-5 py-3 max-md:flex-wrap">
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
    </Modal>
  );
}
