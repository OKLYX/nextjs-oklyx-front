'use client';

import type { OutboundPlace } from '@/domain/entities/ShippingEntity';
import { Modal } from '@/presentation/components/ui/Modal';

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
  if (!isOpen) return null;

  return (
    <Modal
      isOpen
      onClose={onClose}
      title="출고지 선택"
    >
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
    </Modal>
  );
}
