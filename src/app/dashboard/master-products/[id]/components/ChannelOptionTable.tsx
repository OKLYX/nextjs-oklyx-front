'use client';

import { useMemo } from 'react';
import { Spinner } from '@/presentation/components/Spinner';
import type {
  MasterChannelOptionCell,
  MasterOptionResponse,
  MatrixRow,
} from '@/domain/entities/MasterProductEntity';
import type { ListingOptionSummary } from '@/domain/entities/ListingRegistrationEntity';
import { CopyIdButton } from './CopyIdButton';

// 매트릭스 판매가 열과 같은 표기(`12,900원`). ⚠️ 같은 화면에 두 가지 금액 표기가 섞이지 않도록
// `CoverageMatrix.formatWon` 과 형식을 맞춘다.
const formatWon = (v: number) => `${v.toLocaleString('ko-KR')}원`;

const NO_ACCOUNT_LABEL = '계정 없음';
const CHANNEL_ONLY_REASON = '마스터 옵션이 없는 채널 전용 옵션입니다';
const OPTION_ID_PENDING_HINT = '승인 후 부여';

/** 표의 열 하나 = 채널 셀 하나. 매트릭스 라벨 + `channel-options` 응답을 합쳐 만든다. */
interface OptionColumn {
  productListingId: number;
  /** 판매자 · 플랫폼 · 계정라벨 (같은 계정에 셀이 여럿이면 `(2)`, `(3)`). */
  label: string;
  platformProductId: string | null;
  /** 이 셀의 옵션 — 마스터 옵션 id 로 찾는다. */
  byMasterOptionId: Map<number, ListingOptionSummary>;
  /** 마스터에 대응이 없는 옵션(2609_22/D2). 표 아래 별도 구역에 모은다. */
  channelOnly: ListingOptionSummary[];
}

/** 매트릭스 행이 없는 셀(계정이 삭제된 셀)인지 — 열 머리 문구가 달라진다. */
const isOrphanColumn = (label: string) => label.startsWith(NO_ACCOUNT_LABEL);

function indexOptions(cell: MasterChannelOptionCell | undefined) {
  const byMasterOptionId = new Map<number, ListingOptionSummary>();
  const channelOnly: ListingOptionSummary[] = [];
  for (const option of cell?.options ?? []) {
    if (option.masterOptionId != null) byMasterOptionId.set(option.masterOptionId, option);
    else channelOnly.push(option);
  }
  return { byMasterOptionId, channelOnly };
}

interface ChannelOptionTableProps {
  /** 커버리지 매트릭스 행 — 열 라벨(판매자·플랫폼·계정)의 출처. */
  rows: MatrixRow[];
  masterOptions: MasterOptionResponse[];
  /**
   * 채널 옵션 집계. **조회는 `CoverageMatrix` 가 한다** — 채널 행 아래 인라인 옵션 목록도 같은
   * 응답을 쓰므로, 여기서 또 부르면 같은 것을 두 번 읽는다(D6).
   * null = 미로드/조회 중.
   */
  cells: MasterChannelOptionCell[] | null;
  /** 집계 조회 실패 메시지. 빈 문자열 = 실패 아님. */
  error: string;
  /** [옵션 수정] — 「상품 기본 정보 > 옵션」의 그 옵션으로 보낸다. */
  onEditMasterOption: (masterOptionId: number) => void;
}

/**
 * 옵션 × 채널 표 (FEATURE_2609_61).
 * File: src/app/dashboard/master-products/[id]/components/ChannelOptionTable.tsx
 *
 * **용도**: "이 옵션이 어느 채널에서 켜져 있고, 얼마에, 옵션 ID 는 무엇인가"를 한 표에서 본다.
 * 행 = 마스터 옵션, 열 = 채널 셀(계정이 아니다 — 한 계정이 같은 마스터로 쿠팡 페이지를 여럿 가질 수 있다).
 *
 * 🔴 **이 표는 보는 곳이다.** 옵션을 고치는 곳은 「상품 기본 정보 > 옵션」 하나뿐이고, 채널 값(가격·
 * 재고·활성)은 지금처럼 매트릭스 행의 기존 액션·모달이 담당한다. 여기서 편집 지점을 늘리면 같은 값을
 * 두 곳에서 고치게 된다. 표가 하는 일은 셋뿐 — **보여주기 · 복사하기 · [옵션 수정] 으로 보내기.**
 *
 * ⚠️ 데이터는 `getChannelOptions` **한 번**이다(2609_61/D6) — 그 호출의 주인은 `CoverageMatrix` 고
 *    이 컴포넌트는 결과를 prop 으로 받는다. 여기서 다시 조회하지 말 것(채널 행 인라인 목록과 중복).
 * ⚠️ `channel-options` 가 내려준 셀 중 매트릭스에 행이 없는 것(계정이 지워진 셀)도 **버리지 않고**
 *    열 맨 뒤에 「계정 없음」으로 붙인다 — 잘못 매핑된 셀을 찾자고 만든 표라 그런 셀이 제일 중요하다.
 */
export function ChannelOptionTable({
  rows,
  masterOptions,
  cells,
  error,
  onEditMasterOption,
}: ChannelOptionTableProps) {
  const isLoading = cells == null && !error;

  // 열 = 매트릭스 순서 그대로, 그 뒤에 매트릭스에 행이 없는 셀(계정 삭제).
  const columns = useMemo<OptionColumn[]>(() => {
    if (cells == null) return [];
    const byListingId = new Map(cells.map((c) => [c.productListingId, c]));
    const used = new Set<number>();
    const ordered: OptionColumn[] = [];

    for (const row of rows) {
      const rowCells = row.cells ?? (row.cell ? [row.cell] : []);
      rowCells.forEach((matrixCell, index) => {
        const cell = byListingId.get(matrixCell.productListingId);
        used.add(matrixCell.productListingId);
        const suffix = rowCells.length > 1 ? ` (${index + 1})` : '';
        ordered.push({
          productListingId: matrixCell.productListingId,
          label: `${row.sellerName} · ${row.platform} · ${row.accountLabel}${suffix}`,
          platformProductId: cell?.platformProductId ?? matrixCell.platformProductId ?? null,
          ...indexOptions(cell),
        });
      });
    }

    for (const cell of cells) {
      if (used.has(cell.productListingId)) continue;
      ordered.push({
        productListingId: cell.productListingId,
        label: `${NO_ACCOUNT_LABEL} · 상품ID ${cell.platformProductId ?? '–'}`,
        platformProductId: cell.platformProductId,
        ...indexOptions(cell),
      });
    }
    return ordered;
  }, [cells, rows]);

  const channelOnlyColumns = useMemo(
    () => columns.filter((c) => c.channelOnly.length > 0),
    [columns],
  );

  if (isLoading) {
    return (
      <div className="flex min-h-24 items-center justify-center p-4">
        <Spinner size={20} label="불러오는 중..." />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4">
        <p className="rounded bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      </div>
    );
  }

  if (masterOptions.length === 0) {
    return <p className="p-4 text-sm text-gray-500">등록된 옵션이 없습니다.</p>;
  }

  if (columns.length === 0) {
    return <p className="p-4 text-sm text-gray-500">이 마스터에 연결된 판매채널이 없습니다.</p>;
  }

  return (
    <div className="space-y-4 p-4">
      {/* 🔴 채널이 늘면 표가 화면을 넘는다 → 가로 스크롤 + 첫 열 고정. */}
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50 text-left align-top">
              <th className="sticky left-0 z-10 bg-gray-50 px-3 py-2 font-medium text-gray-700">
                옵션
              </th>
              {columns.map((col) => (
                <th
                  key={col.productListingId}
                  className="min-w-40 px-3 py-2 font-medium text-gray-700"
                >
                  <div className={isOrphanColumn(col.label) ? 'text-amber-700' : undefined}>
                    {col.label}
                  </div>
                  {/* 2609_61/D2: 상품 ID 는 마켓 등록 후에 생긴다 — 없다고 경고색으로 그리지 않는다. */}
                  {col.platformProductId ? (
                    <div className="mt-0.5 flex items-center gap-1">
                      <span className="font-mono text-xs tabular-nums font-normal text-gray-900">
                        상품ID {col.platformProductId}
                      </span>
                      <CopyIdButton value={col.platformProductId} />
                    </div>
                  ) : (
                    <div
                      className="mt-0.5 text-xs font-normal text-gray-400"
                      title="마켓 등록 후 부여"
                    >
                      상품ID –
                    </div>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {masterOptions.map((opt) => (
              <tr key={opt.id} className="border-b border-gray-100 align-top">
                <th
                  scope="row"
                  className="sticky left-0 z-10 bg-white px-3 py-2 text-left font-normal"
                >
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-gray-900">{opt.name}</span>
                    {opt.marketRegistered === true && (
                      <span title="쿠팡에 등록돼 판매 중 — 이름 수정 및 삭제 불가">🔒</span>
                    )}
                    {/* 🔴 [옵션 수정] 은 행 머리에 하나다(PLAN/D8). 칸마다 두지 말 것. */}
                    <button
                      type="button"
                      onClick={() => onEditMasterOption(opt.id)}
                      className="rounded border border-blue-300 px-2 py-0.5 text-xs font-medium text-blue-600 hover:bg-blue-50"
                    >
                      옵션 수정
                    </button>
                  </div>
                </th>
                {columns.map((col) => {
                  const option = col.byMasterOptionId.get(opt.id);
                  if (option == null) {
                    return (
                      <td key={col.productListingId} className="px-3 py-2 text-gray-400">
                        –
                      </td>
                    );
                  }
                  const active = option.active !== false;
                  return (
                    <td key={col.productListingId} className="px-3 py-2">
                      <div className={active ? 'text-gray-900' : 'text-gray-400'}>
                        {active
                          ? `${formatWon(option.sellingPrice)} / ${option.stockQuantity ?? option.maxStock}`
                          : '미사용'}
                      </div>
                      <OptionIdCell value={option.platformOptionId ?? null} />
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* 2609_61/D10: 마스터 옵션이 없는 채널 전용 옵션은 행이 없다 → 아래에 셀별로 모은다. */}
      {channelOnlyColumns.length > 0 && (
        <div className="space-y-2 border-t border-gray-200 pt-3">
          <h4 className="text-xs font-semibold text-gray-900">채널 전용 옵션</h4>
          {channelOnlyColumns.map((col) => (
            <div key={col.productListingId} className="rounded border border-gray-200 p-2">
              <p className="mb-1 text-xs font-medium text-gray-700">{col.label}</p>
              <ul className="space-y-1">
                {col.channelOnly.map((option) => (
                  <li
                    key={option.optionId}
                    className="flex flex-wrap items-center gap-2 text-sm text-gray-900"
                  >
                    <span className="font-medium">{option.optionName}</span>
                    <span className="text-gray-500">
                      {option.active !== false
                        ? `${formatWon(option.sellingPrice)} / ${option.stockQuantity ?? option.maxStock}`
                        : '미사용'}
                    </span>
                    <OptionIdCell value={option.platformOptionId ?? null} />
                    <button
                      type="button"
                      disabled
                      title={CHANNEL_ONLY_REASON}
                      className="rounded border border-gray-300 px-2 py-0.5 text-xs font-medium text-gray-400"
                    >
                      옵션 수정
                    </button>
                  </li>
                ))}
              </ul>
              <p className="mt-1 text-[11px] text-amber-700">{CHANNEL_ONLY_REASON}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/** 옵션 ID 한 칸. 승인 전이면 `–` + 사유 툴팁(경고색을 쓰지 않는다 — 2609_61/D2). */
function OptionIdCell({ value }: { value: string | null }) {
  if (!value) {
    return (
      <div className="text-xs text-gray-400" title={OPTION_ID_PENDING_HINT}>
        옵션ID –
      </div>
    );
  }
  return (
    <div className="flex items-center gap-1">
      <span className="font-mono text-xs tabular-nums text-gray-600">옵션ID {value}</span>
      <CopyIdButton value={value} />
    </div>
  );
}
