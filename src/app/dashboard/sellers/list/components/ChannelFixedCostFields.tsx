'use client';

import { ROUTES } from '@/config/routes';
import type {
  AccountFixedCost,
  AccountFixedCostRequestItem,
  FixedCostChargeMode,
  PlatformFixedCost,
} from '@/domain/entities/FixedCost';
import { CHARGE_MODE_OPTIONS, formatFixedCostAmount } from '@/domain/entities/FixedCost';

/**
 * 채널 편집 폼의 <b>고정비</b> 섹션 (FEATURE_2609_33 / PLAN 2609_33 D1 · D2 · D2-1 · D5).
 *
 * 🔴 여기서 <b>금액을 입력받지 않는다</b> — 금액·기본 임계의 소유자는 카탈로그다(비용 &gt; 채널 고정비).
 * 채널이 정하는 것은 부과 기준·임계·적용 월뿐이다.
 *
 * 🔴 체크 해제 = 연결에서 <b>제외</b>(목록에서 빠진다), `부과 안 함` = 연결은 두되 이 채널엔 안 붙는다.
 * 둘을 하나로 합치면 다시 켤 때 임계·적용 월이 사라진다 — 합치지 말 것.
 */
export interface ChannelFixedCostRow {
  fixedCostId: number;
  name: string;
  /** 카탈로그 금액(표시 전용). */
  amount: number;
  /** 카탈로그 기본 임계 — 비운 칸의 placeholder 가 이 값을 보여준다. */
  thresholdAmount: number;
  /** 카탈로그 사용 여부. false 인데 목록에 있으면 = 이미 연결된 중지 항목이다. */
  active: boolean;
  checked: boolean;
  chargeMode: FixedCostChargeMode;
  /** '' = 카탈로그 기본값 사용. */
  thresholdOverride: string;
  /** 'YYYY-MM' 또는 ''. */
  appliedFrom: string;
  appliedTo: string;
}

/**
 * 카탈로그 + 현재 연결 → 편집 행 목록.
 *
 * ⚠️ 표시 대상 = 그 채널 플랫폼의 <b>활성</b> 항목 ∪ <b>이미 연결된</b> 항목. 연결된 중지 항목을 빼면
 * 저장(PUT = 멱등 replace)이 그 연결을 조용히 끊는다.
 */
export function buildFixedCostRows(
  catalog: PlatformFixedCost[],
  links: AccountFixedCost[],
  platform: string
): ChannelFixedCostRow[] {
  const linkByIx = new Map(links.map((link) => [link.fixedCostId, link]));
  return catalog
    .filter((item) => item.platform === platform)
    .filter((item) => item.active || linkByIx.has(item.id))
    .map((item) => {
      const link = linkByIx.get(item.id);
      return {
        fixedCostId: item.id,
        name: item.name,
        amount: item.amount,
        thresholdAmount: item.thresholdAmount,
        active: item.active,
        checked: link != null,
        chargeMode: link?.chargeMode ?? 'AUTO',
        thresholdOverride: link?.thresholdOverride != null ? String(link.thresholdOverride) : '',
        appliedFrom: link?.appliedFrom ?? '',
        appliedTo: link?.appliedTo ?? '',
      };
    });
}

/** 편집 행 → PUT 바디 항목. 체크된 행만 보낸다(빠진 항목은 연결이 끊긴다). */
export function toFixedCostRequestItems(rows: ChannelFixedCostRow[]): AccountFixedCostRequestItem[] {
  return rows
    .filter((row) => row.checked)
    .map((row) => ({
      fixedCostId: row.fixedCostId,
      chargeMode: row.chargeMode,
      thresholdOverride:
        row.chargeMode === 'AUTO' && row.thresholdOverride.trim() !== ''
          ? Number(row.thresholdOverride)
          : null,
      appliedFrom: row.appliedFrom.trim() === '' ? null : row.appliedFrom,
      appliedTo: row.appliedTo.trim() === '' ? null : row.appliedTo,
    }));
}

interface ChannelFixedCostFieldsProps {
  rows: ChannelFixedCostRow[];
  onChange: (rows: ChannelFixedCostRow[]) => void;
  isLoading: boolean;
  /** 카탈로그·연결 조회 실패 문구. 있으면 목록 대신 [다시 시도]를 보여준다. */
  loadError: string;
  onRetry: () => void;
  disabled?: boolean;
}

export function ChannelFixedCostFields({
  rows,
  onChange,
  isLoading,
  loadError,
  onRetry,
  disabled = false,
}: ChannelFixedCostFieldsProps) {
  const patch = (fixedCostId: number, next: Partial<ChannelFixedCostRow>) => {
    onChange(rows.map((row) => (row.fixedCostId === fixedCostId ? { ...row, ...next } : row)));
  };

  const inputCls =
    'w-full px-3 py-1.5 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100';

  return (
    <div className="border-t pt-4 space-y-3">
      <div>
        <label className="block text-sm font-medium">고정비</label>
        <p className="text-xs text-gray-500">
          자동은 그 달 매출이 임계 이상인 달에만 부과합니다. 실제 청구서와 다르면 [항상 부과] 또는 [부과 안 함]으로 덮으세요.
        </p>
      </div>

      {isLoading ? (
        <p className="text-xs text-gray-500">고정비 항목을 불러오는 중...</p>
      ) : loadError ? (
        // 🔴 조회 실패를 "등록된 항목 없음" 안내로 흘리면 이미 등록한 사용자에게 거짓 안내가 된다.
        <div className="rounded-md bg-red-50 p-3 text-sm text-red-700 flex items-center justify-between gap-2">
          <span>고정비 목록을 불러오지 못했습니다.</span>
          <button
            type="button"
            onClick={onRetry}
            className="px-3 py-1 text-xs border border-red-300 rounded hover:bg-red-100 whitespace-nowrap"
          >
            다시 시도
          </button>
        </div>
      ) : rows.length === 0 ? (
        <p className="text-xs text-gray-500">
          등록된 고정비 항목이 없습니다 —{' '}
          <a href={ROUTES.COSTS_FIXED_COST} className="text-blue-600 underline">
            비용 &gt; 채널 고정비
          </a>
          에서 먼저 등록하세요.
        </p>
      ) : (
        <div className="space-y-3">
          {rows.map((row) => (
            <div key={row.fixedCostId} className="rounded-md border border-gray-200 p-3 space-y-2">
              <label className="flex items-center gap-2 text-sm text-gray-900">
                <input
                  type="checkbox"
                  checked={row.checked}
                  onChange={(e) => patch(row.fixedCostId, { checked: e.target.checked })}
                  disabled={disabled}
                  className="h-4 w-4"
                />
                <span>
                  {row.name} 월 {formatFixedCostAmount(row.amount)}원
                  {!row.active && <span className="ml-1 text-xs text-gray-500">(사용 중지)</span>}
                </span>
              </label>

              {row.checked && (
                <div className="pl-6 space-y-2">
                  <div>
                    <label
                      htmlFor={`chargeMode-${row.fixedCostId}`}
                      className="block text-xs font-medium text-gray-700 mb-1"
                    >
                      부과 기준
                    </label>
                    <select
                      id={`chargeMode-${row.fixedCostId}`}
                      value={row.chargeMode}
                      onChange={(e) =>
                        patch(row.fixedCostId, {
                          chargeMode: e.target.value as FixedCostChargeMode,
                        })
                      }
                      disabled={disabled}
                      className={`${inputCls} bg-white`}
                    >
                      {CHARGE_MODE_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  {row.chargeMode === 'AUTO' && (
                    <div>
                      <label
                        htmlFor={`threshold-${row.fixedCostId}`}
                        className="block text-xs font-medium text-gray-700 mb-1"
                      >
                        부과 임계
                      </label>
                      <input
                        id={`threshold-${row.fixedCostId}`}
                        type="number"
                        min={0}
                        value={row.thresholdOverride}
                        onChange={(e) =>
                          patch(row.fixedCostId, { thresholdOverride: e.target.value })
                        }
                        placeholder={`기본값 사용 (현재: ${formatFixedCostAmount(row.thresholdAmount)}원)`}
                        disabled={disabled}
                        className={inputCls}
                      />
                    </div>
                  )}

                  <div className="flex gap-2">
                    <div className="flex-1">
                      <label
                        htmlFor={`appliedFrom-${row.fixedCostId}`}
                        className="block text-xs font-medium text-gray-700 mb-1"
                      >
                        적용 시작(YYYY-MM)
                      </label>
                      <input
                        id={`appliedFrom-${row.fixedCostId}`}
                        type="month"
                        value={row.appliedFrom}
                        onChange={(e) => patch(row.fixedCostId, { appliedFrom: e.target.value })}
                        disabled={disabled}
                        className={inputCls}
                      />
                    </div>
                    <div className="flex-1">
                      <label
                        htmlFor={`appliedTo-${row.fixedCostId}`}
                        className="block text-xs font-medium text-gray-700 mb-1"
                      >
                        적용 종료(YYYY-MM)
                      </label>
                      <input
                        id={`appliedTo-${row.fixedCostId}`}
                        type="month"
                        value={row.appliedTo}
                        onChange={(e) => patch(row.fixedCostId, { appliedTo: e.target.value })}
                        disabled={disabled}
                        className={inputCls}
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
