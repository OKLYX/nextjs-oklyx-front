'use client';

import { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { Spinner } from '@/presentation/components/Spinner';
import { DetailHtmlThumb } from '@/presentation/components/DetailHtmlPreview';
import { resolveThumbUrl } from '@/infrastructure/utils/thumbUrl';
import type { MatrixCell, MasterOptionResponse } from '@/domain/entities/MasterProductEntity';
import type {
  GeneratedProductResponse,
  ListingOptionSummary,
  ListingStatus,
} from '@/domain/entities/ListingRegistrationEntity';
import type { ShippingUseCase } from '@/application/usecases/ShippingUseCase';
import { CellActions } from './CellActions';
import { CopyIdButton } from './CopyIdButton';
import { ListingDetailPanel, formatWon, type ListingOptionView } from './ListingDetailPanel';

// 상태 enum → 화면 문구. ⚠️ enum 원문(`SELLING` 등)을 사용자에게 노출하지 않는다(UI 용어 규칙).
export const STATUS_LABEL: Record<ListingStatus, string> = {
  DRAFT: '미전송',
  SUBMITTED: '승인 대기중',
  SELLING: '판매중',
  REJECTED: '승인 반려',
  SUSPENDED: '판매 중지',
};

const STATUS_CHIP: Record<ListingStatus, string> = {
  DRAFT: 'bg-gray-100 text-gray-600',
  SUBMITTED: 'bg-blue-50 text-blue-700',
  SELLING: 'bg-green-100 text-green-700',
  REJECTED: 'bg-red-100 text-red-700',
  SUSPENDED: 'bg-red-100 text-red-700',
};

/** 「카테고리 불일치」 칩 툴팁(2609_45/D8) — 채널이 마켓에 올라가 있는 자기 카테고리를 쓰는 중이다. */
const OWN_CATEGORY_HINT =
  '이 채널은 마켓에 올라가 있는 자기 카테고리를 사용합니다(마스터 카테고리와 다름). 수수료·필수 항목도 이 카테고리 기준입니다. ⋯ 메뉴의 [마스터 카테고리로 변경]으로 맞출 수 있습니다.';

const NEEDS_SYNC_HINT = '이 채널에서 바꾼 값이 아직 마켓에 가지 않았습니다. [수정 요청]으로 보냅니다.';

/**
 * 셀의 등록 상태. **백엔드가 준 값이 진실**이고, 없을 때만(구버전 응답) 옛 추정으로 폴백한다.
 * 폴백을 남기는 이유 = 프론트가 백엔드보다 먼저 배포돼도 회귀하지 않게.
 */
export const cellStatus = (cell: MatrixCell | null | undefined): ListingStatus =>
  cell?.status ?? (cell?.platformProductId ? 'SUBMITTED' : 'DRAFT');

/**
 * 이 판매상품의 「조치 필요」 칩 수 = 변경 미반영 + 카테고리 불일치. 계정 헤더가 합산한다.
 * ⚠️ 두 신호 모두 서버 값만 본다(`=== true`) — 코드 유무·이름 비교로 다시 판정하지 말 것(2609_45/D10-1).
 */
export const cellActionCount = (cell: MatrixCell): number =>
  (cell.needsMarketSync === true ? 1 : 0) + (cell.usesOwnCategory === true ? 1 : 0);

/**
 * 옵션 표의 한 줄 = `optionPrices`(활성·잠금·가격·재고) 를 기준으로, 있으면 `channel-options`
 * (옵션 ID·마스터 옵션 연결)를 옵션 id 로 겹친다. 둘은 같은 **채널 옵션 id** 공간이다.
 * ⚠️ 활성 여부는 `optionPrices` 가 이긴다 — 토글(43)이 그쪽만 제자리 패치하기 때문이다.
 */
const buildOptionViews = (
  gen: GeneratedProductResponse | null | undefined,
  channelOptions: ListingOptionSummary[] | undefined,
  masterOptions: MasterOptionResponse[],
): ListingOptionView[] => {
  const prices = gen?.optionPrices ?? [];
  const byId = new Map((channelOptions ?? []).map((o) => [o.optionId, o]));
  if (prices.length > 0) {
    return prices.map((p) => {
      const co = byId.get(p.optionId);
      const active = p.active !== false;
      return {
        optionId: p.optionId,
        name:
          p.optionName ??
          co?.optionName ??
          masterOptions.find((o) => o.id === p.optionId)?.name ??
          `옵션 #${p.optionId}`,
        sellingPrice: p.sellingPrice,
        priceManual: p.priceSource === 'MANUAL_OVERRIDE',
        stock: p.stockQuantity ?? p.maxStock,
        stockInherited: p.stockQuantity == null,
        active,
        lockedOff: p.onMarket === true && active,
        platformOptionId: co?.platformOptionId ?? null,
        masterOptionId: co ? (co.masterOptionId ?? null) : undefined,
      };
    });
  }
  // 생성물이 없거나 아직 안 온 셀: 채널 옵션 집계만으로 그린다(잠금 정보는 없다).
  return (channelOptions ?? []).map((o) => ({
    optionId: o.optionId,
    name: o.optionName,
    sellingPrice: o.sellingPrice,
    priceManual: o.priceSource === 'MANUAL_OVERRIDE',
    stock: o.stockQuantity ?? o.maxStock,
    stockInherited: o.stockQuantity == null,
    active: o.active !== false,
    lockedOff: false,
    platformOptionId: o.platformOptionId ?? null,
    masterOptionId: o.masterOptionId ?? null,
  }));
};

interface ListingRowProps {
  masterId: number;
  cell: MatrixCell;
  /** `generated[listingId]` — undefined = 아직 조회 중/안 옴, null = 조회 실패. */
  gen: GeneratedProductResponse | null | undefined;
  genLoading: boolean;
  /** 이 셀의 채널 옵션(ADMIN 집계). undefined = 미로드/비-ADMIN. */
  channelOptions: ListingOptionSummary[] | undefined;
  channelOptionsLoading: boolean;
  masterOptions: MasterOptionResponse[];
  isAdmin: boolean;
  /** 모달·확인창 제목용 꼬리표(`판매자 · 플랫폼[ · 상품ID]`). */
  channelLabel: string;
  accountId: number;
  platform: string;
  optionBusy: boolean;
  onToggleOption: (listingId: number, optionId: number) => void;
  onEditMasterOption: (masterOptionId: number) => void;
  onReload: () => void;
  onPreview: (
    gen: GeneratedProductResponse | null,
    title: string,
    tab: 'image' | 'detail',
  ) => void;
  shippingUseCase: ShippingUseCase;
  onShippingSaved: (listingId: number, updated: GeneratedProductResponse) => void;
  masterCategoryName: string | null;
  onCellRemoved: (message: string) => void;
}

/**
 * 채널 매트릭스의 판매상품(셀) 한 줄 — **기본 접힘**.
 * File: src/app/dashboard/master-products/[id]/components/ListingRow.tsx
 *
 * 접힌 줄 = 펼침 화살표 · 작은 썸네일 · 노출상품명(말줄임) · 보조줄(상품 ID · 옵션 수 · 최저가~ · 재고 합계)
 *   · 상태 칩(+ 「변경 미반영」·「카테고리 불일치」) · 액션(주 버튼 하나 + ⋯ 메뉴, `CellActions`).
 * 펼침 = `ListingDetailPanel`(이름 · 옵션 표 · 태그/이미지/상세페이지).
 *
 * 🔴 가로 스크롤이 생기지 않도록 폭을 고정하는 칸이 없다 — 이름은 `truncate`, 나머지는 flex-wrap.
 * ⚠️ 펼침 상태는 이 컴포넌트 로컬이다. 부모가 `key={listingId}` 로 그리므로 재조회(load)에도 유지된다.
 */
export function ListingRow({
  masterId,
  cell,
  gen,
  genLoading,
  channelOptions,
  channelOptionsLoading,
  masterOptions,
  isAdmin,
  channelLabel,
  accountId,
  platform,
  optionBusy,
  onToggleOption,
  onEditMasterOption,
  onReload,
  onPreview,
  shippingUseCase,
  onShippingSaved,
  masterCategoryName,
  onCellRemoved,
}: ListingRowProps) {
  const [expanded, setExpanded] = useState(false);
  const status = cellStatus(cell);
  const listingId = cell.productListingId;
  const views = buildOptionViews(gen, channelOptions, masterOptions);
  const activeViews = views.filter((v) => v.active);
  const prices = activeViews.map((v) => v.sellingPrice);
  const minPrice = prices.length > 0 ? Math.min(...prices) : cell.sellingPrice;
  const hasPriceRange = prices.length > 1 && new Set(prices).size > 1;
  const stockTotal = activeViews.reduce((sum, v) => sum + v.stock, 0);
  const needsSync = cell.needsMarketSync === true;
  const categoryMismatch = cell.usesOwnCategory === true;
  const categoryLabel = cell.categoryName ?? cell.categoryCode ?? null;

  const thumbUrl = gen?.thumbnailUrl ? resolveThumbUrl(gen.thumbnailUrl) : null;
  const pending = gen === undefined && genLoading;

  const smallThumb = pending ? (
    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded border border-gray-200">
      <Spinner size={12} />
    </span>
  ) : thumbUrl ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={thumbUrl}
      alt={`${channelLabel} 썸네일`}
      onClick={() => onPreview(gen ?? null, channelLabel, 'image')}
      className="h-10 w-10 shrink-0 cursor-pointer rounded border border-gray-200 object-contain hover:opacity-80"
    />
  ) : (
    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded border border-dashed border-gray-200 text-xs text-gray-300">
      –
    </span>
  );

  const bigThumb = pending ? (
    <Spinner size={14} />
  ) : thumbUrl ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={thumbUrl}
      alt={`${channelLabel} 썸네일`}
      onClick={() => onPreview(gen ?? null, channelLabel, 'image')}
      className="h-24 w-24 cursor-pointer rounded border border-gray-200 object-contain hover:opacity-80"
    />
  ) : (
    <span className="text-xs text-gray-400">없음</span>
  );

  const detailThumb = pending ? (
    <Spinner size={14} />
  ) : gen?.detailHtml ? (
    <DetailHtmlThumb
      html={gen.detailHtml}
      width={96}
      height={96}
      onClick={() => onPreview(gen, channelLabel, 'detail')}
    />
  ) : (
    <span className="text-xs text-gray-400">미생성</span>
  );

  return (
    <div className="border-t border-gray-100 first:border-t-0">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2">
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
          aria-label={expanded ? '접기' : '펼치기'}
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded text-gray-500 hover:bg-gray-100"
        >
          {expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        </button>
        {smallThumb}
        <div className="min-w-0 flex-1 basis-48">
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="block w-full truncate text-left text-sm font-medium text-gray-900 hover:underline"
            title={cell.name}
          >
            {cell.name}
          </button>
          <div className="flex min-w-0 flex-wrap items-center gap-x-1.5 text-xs text-gray-500">
            {cell.platformProductId ? (
              <span className="flex items-center gap-0.5">
                <span className="font-mono tabular-nums">{cell.platformProductId}</span>
                <CopyIdButton value={cell.platformProductId} />
              </span>
            ) : (
              // 2609_61/D2: 미전송 셀은 아직 마켓이 ID 를 주지 않았다 — 오류가 아니라 경고색 없음.
              <span className="text-gray-400" title="마켓 등록 후 부여">
                상품 ID –
              </span>
            )}
            <span aria-hidden>·</span>
            <span>옵션 {views.length}개</span>
            {minPrice != null && (
              <>
                <span aria-hidden>·</span>
                <span className="tabular-nums">
                  {formatWon(minPrice)}
                  {hasPriceRange ? '~' : ''}
                </span>
              </>
            )}
            {activeViews.length > 0 && (
              <>
                <span aria-hidden>·</span>
                <span className="tabular-nums">재고 {stockTotal.toLocaleString('ko-KR')}</span>
              </>
            )}
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-1">
          <span className={`rounded px-1.5 py-0.5 text-[11px] ${STATUS_CHIP[status]}`}>
            {STATUS_LABEL[status]}
          </span>
          {needsSync && (
            <span
              className="rounded bg-amber-100 px-1.5 py-0.5 text-[11px] font-medium text-amber-800"
              title={NEEDS_SYNC_HINT}
            >
              변경 미반영
            </span>
          )}
          {categoryMismatch && (
            <span
              className="rounded bg-amber-100 px-1.5 py-0.5 text-[11px] font-medium text-amber-800"
              title={categoryLabel ? `${categoryLabel} — ${OWN_CATEGORY_HINT}` : OWN_CATEGORY_HINT}
            >
              카테고리 불일치
            </span>
          )}
        </div>
        {isAdmin && (
          <CellActions
            masterId={masterId}
            listing={{ id: listingId, status }}
            options={masterOptions}
            onReload={onReload}
            accountId={accountId}
            platform={platform}
            channelLabel={channelLabel}
            shippingOverride={gen?.shippingOverride}
            shippingReady={gen?.shippingReady}
            shippingUseCase={shippingUseCase}
            onShippingSaved={(updated) => onShippingSaved(listingId, updated)}
            usesOwnCategory={categoryMismatch}
            channelCategoryLabel={categoryLabel}
            masterCategoryName={masterCategoryName}
            // ⚠️ 자기 셀 하나만 — 전체를 넘기면 해제·삭제 항목이 셀 수만큼 늘어난다.
            cells={[cell]}
            onCellRemoved={onCellRemoved}
            needsMarketSync={needsSync}
          />
        )}
      </div>
      {expanded && (
        <ListingDetailPanel
          listingId={listingId}
          name={cell.name}
          registrationName={cell.registrationName}
          tags={gen?.tags ?? []}
          isAdmin={isAdmin}
          options={views}
          optionsLoading={pending || (isAdmin && channelOptionsLoading)}
          optionBusy={optionBusy}
          onToggleOption={(optionId) => onToggleOption(listingId, optionId)}
          onEditMasterOption={onEditMasterOption}
          onSaved={onReload}
          thumbnail={bigThumb}
          detailThumb={detailThumb}
        />
      )}
    </div>
  );
}
