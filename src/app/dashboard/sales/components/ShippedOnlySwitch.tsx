'use client';

interface ShippedOnlySwitchProps {
  checked: boolean;
  disabled: boolean;
  onChange: (next: boolean) => void;
}

/**
 * 「출고 전 주문 제외」 switch of the three sales tabs (FEATURE_2611_04 D10 · D11 · D12).
 *
 * - On = sales numbers leave out order lines that have not shipped yet (server condition `excludeUnshipped=true`).
 * - Same track and knob shape as the theme switch in `TopBar.tsx`, without the sun / moon icon.
 * - Each container puts it last inside its `PeriodFilter`; it is disabled while the tab is loading.
 */
export function ShippedOnlySwitch({ checked, disabled, onChange }: ShippedOnlySwitchProps) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-sm font-medium text-gray-700">출고 전 주문 제외</span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label="출고 전 주문 제외"
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-7 w-13 items-center rounded-full transition-colors disabled:opacity-50 ${
          checked ? 'bg-gray-600' : 'bg-gray-300'
        }`}
      >
        <span
          className={`inline-flex h-6 w-6 items-center justify-center rounded-full bg-white text-gray-700 shadow transform transition-transform ${
            checked ? 'translate-x-6' : 'translate-x-0.5'
          }`}
        />
      </button>
    </div>
  );
}
