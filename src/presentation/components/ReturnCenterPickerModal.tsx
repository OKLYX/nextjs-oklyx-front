'use client';

import { useEffect } from 'react';
import type { ReturnCenter } from '@/domain/entities/ShippingEntity';

interface ReturnCenterPickerModalProps {
  isOpen: boolean;
  centers: ReturnCenter[];
  selectedCode: string | null;
  onSelect: (center: ReturnCenter) => void;
  onClose: () => void;
}

/** [zip] address addressDetail — one-line address for a return center card. */
function addressLine(c: ReturnCenter): string {
  const addr = [c.address, c.addressDetail].filter((p) => p && p.trim()).join(' ');
  return c.zipCode ? `[${c.zipCode}] ${addr}` : addr;
}

/**
 * Return-center picker (FEATURE_2608_06 / 74). Addresses are long, so the parent
 * shipping modal shows only a summary and defers the choice to this list modal
 * where each center's full address is visible. Selecting a card fills the parent
 * form and closes. Sits above the shipping modal (z-[60]).
 */
export function ReturnCenterPickerModal({
  isOpen,
  centers,
  selectedCode,
  onSelect,
  onClose,
}: ReturnCenterPickerModalProps) {
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
          <h3 className="text-base font-semibold">반품지 선택</h3>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            ✕
          </button>
        </div>
        <div className="space-y-2 p-4">
          {centers.length === 0 ? (
            <p className="text-sm text-gray-500">조회된 반품지가 없습니다.</p>
          ) : (
            centers.map((c) => {
              const active = c.code === selectedCode;
              return (
                <button
                  key={c.code}
                  type="button"
                  onClick={() => {
                    onSelect(c);
                    onClose();
                  }}
                  className={`block w-full rounded-md border p-3 text-left transition-colors ${
                    active ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="min-w-0 truncate font-medium text-gray-900">{c.name || c.code}</span>
                    <span className="shrink-0 text-xs text-gray-400">{c.code}</span>
                  </div>
                  <p className="mt-1 break-keep text-sm text-gray-600">{addressLine(c)}</p>
                  {c.contactNumber && <p className="truncate text-xs text-gray-500">{c.contactNumber}</p>}
                </button>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
