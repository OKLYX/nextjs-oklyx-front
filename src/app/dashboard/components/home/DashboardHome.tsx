'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import ReactGridLayout, { useContainerWidth } from 'react-grid-layout';
import { gridBounds } from 'react-grid-layout/core';
import 'react-grid-layout/css/styles.css';
import { DASHBOARD_CARD_SPECS, NARROW_GRID, WEB_GRID, narrowHeight } from '@/config/dashboardGrid';
import { DashboardUseCase } from '@/application/usecases/DashboardUseCase';
import { SellerUseCase } from '@/application/usecases/SellerUseCase';
import { DashboardRepositoryImpl } from '@/infrastructure/repositories/DashboardRepositoryImpl';
import { SellerRepositoryImpl } from '@/infrastructure/repositories/SellerRepositoryImpl';
import { toast } from '@/infrastructure/stores/toastStore';
import { extractErrorMessage } from '@/infrastructure/utils/errorMessage';
import type { DashboardCardType, DashboardLayout, DashboardPeriod } from '@/domain/entities/DashboardEntity';
import type { Seller } from '@/domain/entities/SellerEntity';
import { Button } from '@/presentation/components/ui/Button';
import { StateBlock } from '@/presentation/components/ui/StateBlock';
import { PageContainer } from '@/presentation/components/PageContainer';
import { useIsMobile } from '@/presentation/hooks/useIsMobile';
import { AlertCountCard } from './AlertCountCard';
import { ChannelSalesChartCard } from './ChannelSalesChartCard';
import { CARD_SELECT_CLASS, REMOVE_BUTTON_CLASS } from './DashboardCardFrame';
import { DailySalesChartCard } from './DailySalesChartCard';
import { PayoutCard } from './PayoutCard';
import { PeriodSalesCard } from './PeriodSalesCard';
import { PurchaseListCard } from './PurchaseListCard';
import { ReservedShipmentCard } from './ReservedShipmentCard';
import {
  dashboardSizes,
  fromGridLayout,
  placeAtBottom,
  toGridLayout,
  toNarrowCards,
  toWebCards,
  toWebRequest,
  visibleTypes,
  type WebCard,
} from './dashboardLayout';

type LoadState = 'loading' | 'error' | 'ready';

/**
 * Dashboard home (`/dashboard`, FEATURE_2610_29 D1 · D2 · D3 · D16 · D19).
 *
 * - Cards sit on the invisible grid of `WEB_GRID` (8 columns, rows without end).
 * - [편집] turns on edit mode: drag a card to move it, drag its lower-right corner to resize it (1 · 2 · 4 wide ·
 *   1 · 2 high, not under its minimum), ✕ removes it, 「카드 넣기」 adds one at the bottom. [편집 완료] saves to the
 *   server; until then nothing is saved.
 * - Outside edit mode a tap on a card opens its screen; a period change is saved at once.
 * - Below 768px (FEATURE_2610_31 D8 · D17 · D18): the cards sit on `NARROW_GRID` (2 columns; `narrowHeight` tall) in the
 *   mobile app's places (`toNarrowCards`), with no [편집]. A period change saves the stored web places with the new
 *   period, so web edits in progress stay unsaved until [편집 완료] on a wide screen.
 */
export function DashboardHome() {
  const useCase = useMemo(() => new DashboardUseCase(new DashboardRepositoryImpl()), []);
  const sellerUseCase = useMemo(() => new SellerUseCase(new SellerRepositoryImpl()), []);
  const { width, containerRef, mounted } = useContainerWidth();
  const isMobile = useIsMobile();
  const [loadState, setLoadState] = useState<LoadState>('loading');
  const [layout, setLayout] = useState<DashboardLayout | null>(null);
  const [admin, setAdmin] = useState(false);
  const [cards, setCards] = useState<WebCard[]>([]);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [pick, setPick] = useState<DashboardCardType | ''>('');
  const [sellers, setSellers] = useState<Seller[]>([]);

  const load = useCallback(async () => {
    setLoadState('loading');
    try {
      const loaded = await useCase.getLayout();
      setLayout(loaded);
      setAdmin(loaded.admin);
      setCards(toWebCards(loaded));
      setLoadState('ready');
    } catch {
      setLoadState('error');
    }
  }, [useCase]);

  useEffect(() => {
    const loadInitialLayout = async () => {
      await load();
    };
    loadInitialLayout();
  }, [load]);

  // FEATURE_2610_30 D37: the chart cards' seller list, read once when an admin opens the dashboard. After a failure
  // the selectors offer 「전체」 alone and the cards stay as they are.
  useEffect(() => {
    if (!admin) return;
    sellerUseCase
      .getAll()
      .then(setSellers)
      .catch(() => setSellers([]));
  }, [admin, sellerUseCase]);

  const save = async (next: WebCard[]): Promise<boolean> => {
    try {
      const saved = await useCase.saveWebLayout(toWebRequest(next));
      setLayout(saved);
      setAdmin(saved.admin);
      setCards(toWebCards(saved));
      return true;
    } catch (e) {
      toast.error(extractErrorMessage(e, '대시보드를 저장하지 못했습니다.'));
      return false;
    }
  };

  const finishEditing = async () => {
    setSaving(true);
    const saved = await save(cards);
    setSaving(false);
    if (saved) {
      setEditing(false);
      setPick('');
      toast.success('대시보드를 저장했습니다.');
    }
  };

  const changePeriod = (type: DashboardCardType, period: DashboardPeriod) => {
    const next = cards.map((card) => (card.type === type ? { ...card, period } : card));
    setCards(next);
    void save(next);
  };

  // Narrow screen (D18): save the stored web places with the new period — the cards on screen only get the period,
  // so the places of a web edit in progress stay unsaved.
  const changeNarrowPeriod = (type: DashboardCardType, period: DashboardPeriod) => {
    if (layout === null) return;
    setCards((current) => current.map((card) => (card.type === type ? { ...card, period } : card)));
    const stored = toWebCards(layout).map((card) => (card.type === type ? { ...card, period } : card));
    useCase
      .saveWebLayout(toWebRequest(stored))
      .then(setLayout)
      .catch((e) => toast.error(extractErrorMessage(e, '대시보드를 저장하지 못했습니다.')));
  };

  const removeCard = (type: DashboardCardType) => setCards((current) => current.filter((card) => card.type !== type));

  const addCard = () => {
    if (pick === '') return;
    setCards((current) => placeAtBottom(current, pick));
    setPick('');
  };

  const addable = visibleTypes(admin).filter((type) => !cards.some((card) => card.type === type));

  const renderCard = (card: Pick<WebCard, 'type' | 'period'>, narrow: boolean) => {
    const spec = DASHBOARD_CARD_SPECS[card.type];
    const common = { editing: narrow ? false : editing, onRemove: () => removeCard(card.type) };
    const onPeriodChange = (period: DashboardPeriod) =>
      narrow ? changeNarrowPeriod(card.type, period) : changePeriod(card.type, period);
    switch (card.type) {
      case 'PAID_ORDERS':
        return <AlertCountCard title={spec.title} href={spec.href} field="paidOrders" {...common} />;
      case 'NEW_ORDERS':
        return <AlertCountCard title={spec.title} href={spec.href} field="newOrders" {...common} />;
      case 'OPEN_CLAIMS':
        return <AlertCountCard title={spec.title} href={spec.href} field="openClaims" {...common} />;
      case 'UNANSWERED_INQUIRIES':
        return <AlertCountCard title={spec.title} href={spec.href} field="unansweredInquiries" {...common} />;
      case 'PERIOD_SALES':
        return <PeriodSalesCard period={card.period ?? 'THIS_MONTH'} onPeriodChange={onPeriodChange} {...common} />;
      case 'SETTLEMENT_PAYOUTS':
        return <PayoutCard sellers={sellers} {...common} narrow={narrow} />;
      case 'PURCHASE_LIST':
        return <PurchaseListCard {...common} />;
      case 'RESERVED_SHIPMENTS':
        return <ReservedShipmentCard {...common} />;
      case 'DAILY_SALES_CHART':
        return (
          <DailySalesChartCard
            period={card.period ?? 'DAYS_7'}
            onPeriodChange={onPeriodChange}
            sellers={sellers}
            {...common}
          />
        );
      case 'CHANNEL_SALES_CHART':
        return (
          <ChannelSalesChartCard
            period={card.period ?? 'DAYS_7'}
            onPeriodChange={onPeriodChange}
            sellers={sellers}
            narrow={narrow}
            {...common}
          />
        );
    }
  };

  // The period on screen is the shared card period (`cards`) — a narrow change shows before the save returns.
  const narrowCards =
    layout === null
      ? []
      : toNarrowCards(layout).map((card) => ({
          ...card,
          period: cards.find((entry) => entry.type === card.type)?.period ?? card.period,
        }));

  const action =
    loadState !== 'ready' || isMobile ? undefined : editing ? (
      <div className="flex flex-wrap items-center gap-2">
        <select
          aria-label="카드 넣기"
          value={pick}
          disabled={addable.length === 0 || saving}
          onChange={(e) => setPick(e.target.value as DashboardCardType | '')}
          className={CARD_SELECT_CLASS}
        >
          <option value="">{addable.length === 0 ? '넣을 카드가 없습니다' : '카드 고르기'}</option>
          {addable.map((type) => (
            <option key={type} value={type}>
              {DASHBOARD_CARD_SPECS[type].title}
            </option>
          ))}
        </select>
        <Button size="sm" variant="secondary" disabled={pick === '' || saving} onClick={addCard}>
          카드 넣기
        </Button>
        <Button size="sm" isLoading={saving} loadingText="저장 중..." onClick={finishEditing}>
          편집 완료
        </Button>
      </div>
    ) : (
      <Button size="sm" variant="secondary" onClick={() => setEditing(true)}>
        편집
      </Button>
    );

  return (
    <PageContainer title="Welcome to OCLYX" action={action}>
      <div ref={containerRef}>
        {loadState === 'loading' && <StateBlock variant="loading" message="불러오는 중..." />}
        {loadState === 'error' && (
          <div className="flex flex-col items-center gap-3">
            <StateBlock variant="error" message="대시보드를 불러오지 못했습니다." />
            <Button size="sm" variant="secondary" onClick={() => void load()}>
              다시 시도
            </Button>
          </div>
        )}
        {loadState === 'ready' && cards.length === 0 && (
          <StateBlock variant="empty" message="보일 카드가 없습니다. [편집]에서 카드를 넣으세요." />
        )}
        {loadState === 'ready' && isMobile && (
          <div
            className="grid"
            style={{
              gridTemplateColumns: `repeat(${NARROW_GRID.cols}, minmax(0, 1fr))`,
              gap: `${NARROW_GRID.gap}px`,
            }}
          >
            {narrowCards.map((card) => (
              <div key={card.type} style={{ gridColumn: `span ${card.w}`, height: `${narrowHeight(card.type)}px` }}>
                {renderCard(card, true)}
              </div>
            ))}
          </div>
        )}
        {loadState === 'ready' && !isMobile && mounted && (
          <ReactGridLayout
            width={width}
            layout={toGridLayout(cards)}
            gridConfig={{
              cols: WEB_GRID.cols,
              rowHeight: WEB_GRID.rowHeight,
              margin: [WEB_GRID.gap, WEB_GRID.gap],
              containerPadding: [0, 0],
            }}
            dragConfig={{ enabled: editing, cancel: `.${REMOVE_BUTTON_CLASS}` }}
            resizeConfig={{ enabled: editing, handles: ['se'] }}
            constraints={[gridBounds, dashboardSizes]}
            onLayoutChange={(layout) => setCards((current) => fromGridLayout(current, layout))}
          >
            {cards.map((card) => (
              <div key={card.type}>{renderCard(card, false)}</div>
            ))}
          </ReactGridLayout>
        )}
      </div>
    </PageContainer>
  );
}
