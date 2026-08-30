'use client';

import { useEffect } from 'react';
import type { OutboundPlace } from '@/domain/entities/ShippingEntity';

interface OutboundPlacePickerModalProps {
  isOpen: boolean;
  places: OutboundPlace[];
  selectedCode: string | null;
  onSelect: (place: OutboundPlace) => void;
  onClose: () => void;
}

/**
 * Outbound-place picker (FEATURE_2608_06 / 74). Mirrors ReturnCenterPickerModal
 * for a consistent selection UX; outbound places only carry a name + code (no
 * address block), so each card shows just those. Sits above the shipping modal.
 */
export function OutboundPlacePickerModal({
  isOpen,
  places,
  selectedCode,
  onSelect,
  onClose,
}: OutboundPlacePickerModalProps) {
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      window.addEventListener('keydown', handleEsc);
      return () => window.removeEventListener('keydown', handleEsc);
    }
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4">
      <div className="max-h-[80vh] w-full max-w-lg overflow-y-auto rounded-lg bg-white shadow-lg">
        <div className="flex items-center justify-between border-b p-4">
          <h3 className="text-base font-semibold">출고지 선택</h3>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            ✕
          </button>
        </div>
        <div className="space-y-2 p-4">
          {places.length === 0 ? (
            <p className="text-sm text-gray-500">조회된 출고지가 없습니다.</p>
          ) : (
            places.map((p) => {
              const active = p.code === selectedCode;
              return (
                <button
                  key={p.code}
                  type="button"
                  onClick={() => {
                    onSelect(p);
                    onClose();
                  }}
                  className={`block w-full rounded-md border p-3 text-left transition-colors ${
                    active ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="min-w-0 truncate font-medium text-gray-900">{p.name || p.code}</span>
                    <span className="shrink-0 text-xs text-gray-400">{p.code}</span>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
