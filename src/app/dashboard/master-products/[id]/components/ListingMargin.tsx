'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Spinner } from '@/presentation/components/Spinner';
import { ListingRegistrationUseCase } from '@/application/usecases/ListingRegistrationUseCase';
import { ListingRegistrationRepositoryImpl } from '@/infrastructure/repositories/ListingRegistrationRepositoryImpl';
import { formatKstWallClock } from '@/infrastructure/utils/kstWallClock';
import { extractErrorMessage } from '@/infrastructure/utils/errorMessage';
import type { OptionMargin, SiteMargin } from '@/domain/entities/ListingRegistrationEntity';
import { formatPercent, formatWon } from '@/app/dashboard/listings/repricing/components/RepricingTable';

/**
 * Margin view parts of the master detail (FEATURE_2610_27 · FEATURE_2610_28).
 * File: src/app/dashboard/master-products/[id]/components/ListingMargin.tsx
 *
 * - `MarginSummary`: the 「마진」 cell of the option table — margin amount + rate, red when under the preset minimum
 *   (2610_27 D4 · D5), the reason instead of numbers when it cannot be calculated (2610_27 D12), and 「마켓 가격 없음 —
 *   시스템 가격 기준」 under a margin judged on the system price (2610_27 D2). An ESM option shows a 「G」 line and an
 *   「옥션」 line (2610_27 D3).
 * - `MarginBreakdown`: what opens under the option — one formula per site, headed 「G마켓」 · 「옥션」 on an ESM option
 *   (2610_28 D4 · D9 · D21).
 * - `SiteBreakdown`: one formula (2610_28 D3 · D5 · D7 · D10 · D12 ~ D15) — the price, 「− 상품 매입가」 with one lighter (단가 × 수량 = 금액) line per
 *   component, 「− 상자비」, 「− 택배비」, 「− 판매 수수료」, 「− 배송비 수수료」 (only when not 0), 「= 마진」, 「손익분기가」,
 *   「최소 마진 기준」 (only when set) and 「마켓 가격 확인: MM/DD HH:mm」 (only when known). When the margin cannot be
 *   calculated: the reason, the price and the check time only.
 * - `MarginPreviewText`: the margin of a price typed in the [가격 설정] window, asked 300 ms after typing stops
 *   (2610_27 D6 · D20 · D38), with 「▸」 that opens its formula under the input row (2610_28 D16). Saving is never
 *   blocked (2610_27 D21).
 *
 * The numbers are the server's (`PriceCalculator.breakdown`) — never compute a margin, a rate or a difference here
 * (2610_27 D8 · D20 · 2610_28 D2).
 */

/** D2: shown under a margin judged on the system price. */
export const MARKET_PRICE_MISSING_NOTE = '마켓 가격 없음 — 시스템 가격 기준';

/** D38: how long typing must stop before the preview is asked. */
const PREVIEW_DELAY_MS = 300;

/** 2610_27 D3: the summary prefix of each ESM site (a single-site option has none). */
const SUMMARY_LABELS: Record<string, string> = { GMARKET: 'G ', AUCTION: '옥션 ' };

/** 2610_28 D21: the formula heading of each ESM site. */
const SITE_TITLES: Record<string, string> = { GMARKET: 'G마켓', AUCTION: '옥션' };

/** D11 · D12: 「{amount} ({rate})」, or the reason when the margin cannot be calculated. */
export const marginText = (site: SiteMargin): string =>
  site.reason ?? `${formatWon(site.marginAmount)} (${formatPercent(site.marginRate)})`;

/** D26 · D32: the KST wall clock as 「MM/DD HH:mm」 — cut from the string, never converted through `Date`. */
export const marketCheckedText = (marketPriceAt: string): string =>
  `마켓 가격 확인: ${formatKstWallClock(marketPriceAt).slice(5).replace('-', '/')}`;

/** 2610_28 D13: 「3,000원 · 10.0%」 — only the minimums that are set; '' when neither is. */
const minimumText = (site: SiteMargin): string =>
  [
    site.minMarginAmount == null ? null : formatWon(site.minMarginAmount),
    site.minMarginRate == null ? null : `${(Math.round(site.minMarginRate * 1000) / 10).toFixed(1)}%`,
  ]
    .filter((part) => part != null)
    .join(' · ');

export function MarginSummary({ margin }: { margin: OptionMargin }) {
  const multi = margin.sites.length > 1;
  return (
    <>
      {margin.sites.map((site) => (
        <span key={site.site} className="block">
          <span className={site.reason != null ? 'text-gray-500' : site.below ? 'text-red-600' : 'text-gray-900'}>
            {multi ? (SUMMARY_LABELS[site.site] ?? '') : ''}
            {marginText(site)}
          </span>
          {site.marketPriceMissing && (
            <span className="block text-[10px] text-gray-500">{MARKET_PRICE_MISSING_NOTE}</span>
          )}
        </span>
      ))}
    </>
  );
}

interface FormulaLineProps {
  /** The operator column: '−' for a deducted amount, '=' for the margin, '' for the starting price. */
  sign?: string;
  label: string;
  amount: ReactNode;
  /** The 「= 마진」 line: a rule above, bold, green or red (2610_28 D4). */
  total?: boolean;
  below?: boolean;
}

/**
 * 2610_28 D4: one line that takes part in the calculation — operator column, name on the left, amount right-aligned.
 * Reference lines (component detail, break-even, minimum) use `DetailLine` / `InfoLine` instead, so what is summed
 * and what only explains it never look alike.
 */
function FormulaLine({ sign = '', label, amount, total = false, below = false }: FormulaLineProps) {
  const tone = total ? (below ? 'text-red-600' : 'text-emerald-700') : 'text-gray-900';
  return (
    <div
      className={`grid grid-cols-[0.75rem_1fr_auto] items-baseline gap-x-2 ${
        total ? 'mt-1 border-t border-gray-300 pt-1.5 font-semibold' : ''
      }`}
    >
      <span className={`text-center ${total ? tone : 'text-gray-400'}`}>{sign}</span>
      <span className={total ? tone : 'text-gray-700'}>{label}</span>
      <span className={`text-right tabular-nums ${tone}`}>{amount}</span>
    </div>
  );
}

/**
 * A component under 「상품 매입가」 (2610_28 D7 · D14): explanation only, not added again — lighter, smaller, and the
 * figures in parentheses as 「(단가 × 수량 = 금액)」.
 */
function DetailLine({ name, unitPrice, quantity, amount }: { name: string; unitPrice: number | null; quantity: number; amount: number | null }) {
  return (
    <div className="ml-5 grid grid-cols-[1fr_auto] items-baseline gap-x-3 border-l-2 border-gray-200 pl-2 text-[11px] text-gray-400">
      <span className="truncate">{name}</span>
      <span className="text-right tabular-nums">
        {unitPrice == null || amount == null ? (
          <>
            (<span className="text-red-600">단가 없음</span> × {quantity})
          </>
        ) : (
          `(${formatWon(unitPrice)} × ${quantity} = ${formatWon(amount)})`
        )}
      </span>
    </div>
  );
}

/** A reference line below the margin (break-even, minimum) — not part of the calculation. */
function InfoLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[1fr_auto] items-baseline gap-x-3 text-[11px] text-gray-500">
      <span>{label}</span>
      <span className="text-right tabular-nums">{value}</span>
    </div>
  );
}

interface SiteBreakdownProps {
  site: SiteMargin;
  /** 2610_28 D9: 「G마켓」 · 「옥션」 above the formula of an ESM site; null = no heading. */
  title: string | null;
  /** 2610_28 D16: 「입력한 가격」 in the [가격 설정] window; null = 「마켓 가격」 or 「시스템 가격 (마켓 가격 없음)」 (D5). */
  priceLabel: string | null;
  /** 2610_28 D16: as wide as the window; false = as wide as its content (D4). */
  wide: boolean;
}

export function SiteBreakdown({ site, title, priceLabel, wide }: SiteBreakdownProps) {
  const firstLabel = priceLabel ?? (site.marketPriceMissing ? '시스템 가격 (마켓 가격 없음)' : '마켓 가격');
  const minimum = minimumText(site);
  return (
    <div
      className={`${wide ? 'w-full' : 'w-max min-w-[18rem] max-w-full'} space-y-1 rounded-md border border-gray-200 bg-gray-50 px-3 py-2.5 text-xs`}
    >
      {title != null && (
        <p className="border-b border-gray-200 pb-1 text-[11px] font-semibold text-gray-900">{title}</p>
      )}
      {site.reason != null ? (
        <>
          <p className="text-gray-500">{site.reason}</p>
          <FormulaLine label={firstLabel} amount={formatWon(site.judgedPrice)} />
        </>
      ) : (
        <>
          <FormulaLine label={firstLabel} amount={formatWon(site.judgedPrice)} />
          <FormulaLine sign="−" label="상품 매입가" amount={formatWon(site.costSum)} />
          {site.components.length > 0 && (
            <div className="space-y-0.5 pb-0.5">
              {site.components.map((component, index) => (
                <DetailLine
                  key={`${index}-${component.productName}`}
                  name={component.productName}
                  unitPrice={component.unitPrice}
                  quantity={component.quantity}
                  amount={component.amount}
                />
              ))}
            </div>
          )}
          <FormulaLine sign="−" label="상자비" amount={formatWon(site.box)} />
          <FormulaLine sign="−" label="택배비" amount={formatWon(site.delivery)} />
          <FormulaLine
            sign="−"
            label={`판매 수수료 (${formatPercent(site.commissionRate)}, 부가세 포함)`}
            amount={formatWon(site.commissionAmount)}
          />
          {site.shippingFeeCommission != null && site.shippingFeeCommission > 0 && (
            <FormulaLine sign="−" label="배송비 수수료 (3.3%)" amount={formatWon(site.shippingFeeCommission)} />
          )}
          <FormulaLine
            sign="="
            total
            below={site.below}
            label={`마진 (${formatPercent(site.marginRate)})`}
            amount={formatWon(site.marginAmount)}
          />
          <div className="mt-1.5 space-y-0.5 border-t border-dashed border-gray-200 pt-1.5">
            <InfoLine label="손익분기가" value={formatWon(site.breakEvenPrice)} />
            {minimum !== '' && <InfoLine label="최소 마진 기준" value={minimum} />}
          </div>
        </>
      )}
      {site.marketPriceAt != null && (
        <p className="text-right text-[10px] text-gray-400">{marketCheckedText(site.marketPriceAt)}</p>
      )}
    </div>
  );
}

export function MarginBreakdown({ margin }: { margin: OptionMargin }) {
  const multi = margin.sites.length > 1;
  return (
    <div className="space-y-2">
      {margin.sites.map((site) => (
        <SiteBreakdown
          key={site.site}
          site={site}
          title={multi ? (SITE_TITLES[site.site] ?? site.site) : null}
          priceLabel={null}
          wide={false}
        />
      ))}
    </div>
  );
}

interface MarginPreviewTextProps {
  listingId: number;
  optionId: number;
  /** 2610_28 D20 · D21: the site the price is for — the listing's platform, or 'GMARKET' · 'AUCTION' on ESM. */
  site: string;
  /** The price typed in; null = not a valid price (nothing is asked, nothing is shown). */
  price: number | null;
}

/**
 * The margin line (inside the input row, `w-36`) and, once 「▸」 is clicked, the formula of the same answer as the
 * row's last, full-width item (2610_28 D16 — the row must be `flex-wrap`). A new price hides the formula until its
 * answer arrives; the open state stays.
 */
export function MarginPreviewText({ listingId, optionId, site, price }: MarginPreviewTextProps) {
  const useCase = useMemo(
    () => new ListingRegistrationUseCase(new ListingRegistrationRepositoryImpl()),
    [],
  );
  const [result, setResult] = useState<{ price: number; margin: SiteMargin | null; error: string } | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (price == null) return;
    let alive = true;
    const timer = setTimeout(async () => {
      try {
        const margin = await useCase.previewMargin(listingId, optionId, { price, site });
        if (alive) setResult({ price, margin, error: '' });
      } catch (e: unknown) {
        if (alive) setResult({ price, margin: null, error: extractErrorMessage(e, '마진을 계산하지 못했습니다.') });
      }
    }, PREVIEW_DELAY_MS);
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [useCase, listingId, optionId, site, price]);

  let line: ReactNode = null;
  let formula: ReactNode = null;
  if (price != null) {
    if (result == null || result.price !== price) {
      line = <Spinner size={12} />;
    } else if (result.margin == null) {
      line = <span className="text-gray-500">{result.error}</span>;
    } else {
      const margin = result.margin;
      line = (
        <button
          type="button"
          onClick={() => setOpen((prev) => !prev)}
          aria-expanded={open}
          className={`text-right hover:underline ${
            margin.reason != null ? 'text-gray-500' : margin.below ? 'text-red-600' : 'text-gray-600'
          }`}
        >
          {margin.reason == null && '마진 '}
          {marginText(margin)} {open ? '▾' : '▸'}
        </button>
      );
      if (open) {
        formula = (
          <div className="order-last basis-full">
            <SiteBreakdown site={margin} title={SITE_TITLES[site] ?? null} priceLabel="입력한 가격" wide />
          </div>
        );
      }
    }
  }
  return (
    <>
      <span className="w-36 shrink-0 text-right text-[11px]">{line}</span>
      {formula}
    </>
  );
}
