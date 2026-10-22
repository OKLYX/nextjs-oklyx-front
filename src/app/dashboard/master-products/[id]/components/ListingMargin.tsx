'use client';

import { useEffect, useMemo, useState } from 'react';
import { Spinner } from '@/presentation/components/Spinner';
import { ListingRegistrationUseCase } from '@/application/usecases/ListingRegistrationUseCase';
import { ListingRegistrationRepositoryImpl } from '@/infrastructure/repositories/ListingRegistrationRepositoryImpl';
import { formatKstWallClock } from '@/infrastructure/utils/kstWallClock';
import { extractErrorMessage } from '@/infrastructure/utils/errorMessage';
import type { OptionMargin, SiteMargin } from '@/domain/entities/ListingRegistrationEntity';
import { formatPercent, formatWon } from '@/app/dashboard/listings/repricing/components/RepricingTable';

/**
 * Margin view parts of the master detail (FEATURE_2610_27).
 * File: src/app/dashboard/master-products/[id]/components/ListingMargin.tsx
 *
 * - `MarginSummary`: the 「마진」 cell of the option table (D11) — margin amount + rate, red when under the preset
 *   minimum (D4 · D5), the reason instead of numbers when it cannot be calculated (D12), and 「마켓 가격 없음 — 시스템
 *   가격 기준」 under a margin judged on the system price (D2). An ESM option shows a 「G」 line and an 「옥션」 line (D3).
 * - `MarginBreakdown`: the line opened under the option (D11) — 「마켓 가격 · 시스템 가격 · 원가합 · 택배비 · 박스비 · 수수료 ·
 *   손익분기가」, then 「마켓 가격 확인: MM/DD HH:mm」 when the check time is known (D26 · D35).
 * - `MarginPreviewText`: the margin of a price typed in the [가격 설정] window, asked 300 ms after typing stops
 *   (D6 · D20 · D38). Saving is never blocked (D21).
 *
 * The numbers are the server's (`PriceCalculator.breakdown`) — never compute a margin here (D8 · D20).
 */

/** D2: shown under a margin judged on the system price. */
export const MARKET_PRICE_MISSING_NOTE = '마켓 가격 없음 — 시스템 가격 기준';

/** D38: how long typing must stop before the preview is asked. */
const PREVIEW_DELAY_MS = 300;

/** D11 · D12: 「{amount} ({rate})」, or the reason when the margin cannot be calculated. */
export const marginText = (site: SiteMargin): string =>
  site.reason ?? `${formatWon(site.marginAmount)} (${formatPercent(site.marginRate)})`;

/** D26 · D32: the KST wall clock as 「MM/DD HH:mm」 — cut from the string, never converted through `Date`. */
export const marketCheckedText = (marketPriceAt: string): string =>
  `마켓 가격 확인: ${formatKstWallClock(marketPriceAt).slice(5).replace('-', '/')}`;

const siteLines = (m: OptionMargin): { label: string; site: SiteMargin }[] =>
  m.auctionMargin == null
    ? [{ label: '', site: m.margin }]
    : [
        { label: 'G ', site: m.margin },
        { label: '옥션 ', site: m.auctionMargin },
      ];

export function MarginSummary({ margin }: { margin: OptionMargin }) {
  return (
    <>
      {siteLines(margin).map(({ label, site }) => (
        <span key={label} className="block">
          <span className={site.reason != null ? 'text-gray-500' : site.below ? 'text-red-600' : 'text-gray-900'}>
            {label}
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

/** D11: the seven parts of one price, in the order the decision lists them. */
const breakdownText = (label: string, site: SiteMargin): string =>
  `${label}마켓 가격 ${formatWon(site.marketPrice)} · 시스템 가격 ${formatWon(site.systemPrice)} · ` +
  `원가합 ${formatWon(site.costSum)} · 택배비 ${formatWon(site.delivery)} · 박스비 ${formatWon(site.box)} · ` +
  `수수료 ${formatWon(site.feeAmount)} · 손익분기가 ${formatWon(site.breakEvenPrice)}`;

export function MarginBreakdown({ margin }: { margin: OptionMargin }) {
  return (
    <div className="space-y-0.5 text-[11px] text-gray-600">
      {siteLines(margin).map(({ label, site }) => (
        <p key={label}>{breakdownText(label, site)}</p>
      ))}
      {margin.marketPriceAt != null && <p>{marketCheckedText(margin.marketPriceAt)}</p>}
    </div>
  );
}

interface MarginPreviewTextProps {
  listingId: number;
  optionId: number;
  /** true = the Auction field of an ESM option. */
  auction: boolean;
  /** The price typed in; null = not a valid price (nothing is asked, nothing is shown). */
  price: number | null;
}

export function MarginPreviewText({ listingId, optionId, auction, price }: MarginPreviewTextProps) {
  const useCase = useMemo(
    () => new ListingRegistrationUseCase(new ListingRegistrationRepositoryImpl()),
    [],
  );
  const [result, setResult] = useState<{ price: number; site: SiteMargin | null; error: string } | null>(null);

  useEffect(() => {
    if (price == null) return;
    let alive = true;
    const timer = setTimeout(async () => {
      try {
        const site = await useCase.previewMargin(listingId, optionId, { price, auction });
        if (alive) setResult({ price, site, error: '' });
      } catch (e: unknown) {
        if (alive) setResult({ price, site: null, error: extractErrorMessage(e, '마진을 계산하지 못했습니다.') });
      }
    }, PREVIEW_DELAY_MS);
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [useCase, listingId, optionId, auction, price]);

  if (price == null) return null;
  if (result == null || result.price !== price) return <Spinner size={12} />;
  if (result.site == null) return <span className="text-gray-500">{result.error}</span>;
  return (
    <span className={result.site.reason != null ? 'text-gray-500' : result.site.below ? 'text-red-600' : 'text-gray-600'}>
      {result.site.reason == null && '마진 '}
      {marginText(result.site)}
    </span>
  );
}
