'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import ReactGridLayout, { useContainerWidth } from 'react-grid-layout';
import { gridBounds } from 'react-grid-layout/core';
import 'react-grid-layout/css/styles.css';
import { DASHBOARD_CARD_SPECS, WEB_GRID } from '@/config/dashboardGrid';
import { DashboardUseCase } from '@/application/usecases/DashboardUseCase';
import { DashboardRepositoryImpl } from '@/infrastructure/repositories/DashboardRepositoryImpl';
import { toast } from '@/infrastructure/stores/toastStore';
import { extractErrorMessage } from '@/infrastructure/utils/errorMessage';
import type { DashboardCardType, DashboardPeriod } from '@/domain/entities/DashboardEntity';
import { Button } from '@/presentation/components/ui/Button';
import { StateBlock } from '@/presentation/components/ui/StateBlock';
import { PageContainer } from '@/presentation/components/PageContainer';
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
 */
export function DashboardHome() {
  const useCase = useMemo(() => new DashboardUseCase(new DashboardRepositoryImpl()), []);
  const { width, containerRef, mounted } = useContainerWidth();
  const [loadState, setLoadState] = useState<LoadState>('loading');
  const [admin, setAdmin] = useState(false);
  const [cards, setCards] = useState<WebCard[]>([]);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [pick, setPick] = useState<DashboardCardType | ''>('');

  const load = useCallback(async () => {
    setLoadState('loading');
    try {
      const layout = await useCase.getLayout();
      setAdmin(layout.admin);
      setCards(toWebCards(layout));
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

  const save = async (next: WebCard[]): Promise<boolean> => {
    try {
      const layout = await useCase.saveWebLayout(toWebRequest(next));
      setAdmin(layout.admin);
      setCards(toWebCards(layout));
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

  const removeCard = (type: DashboardCardType) => setCards((current) => current.filter((card) => card.type !== type));

  const addCard = () => {
    if (pick === '') return;
    setCards((current) => placeAtBottom(current, pick));
    setPick('');
  };

  const addable = visibleTypes(admin).filter((type) => !cards.some((card) => card.type === type));

  const renderCard = (card: WebCard) => {
    const spec = DASHBOARD_CARD_SPECS[card.type];
    const common = { editing, onRemove: () => removeCard(card.type) };
    const onPeriodChange = (period: DashboardPeriod) => changePeriod(card.type, period);
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
        return <PayoutCard {...common} />;
      case 'PURCHASE_LIST':
        return <PurchaseListCard {...common} />;
      case 'RESERVED_SHIPMENTS':
        return <ReservedShipmentCard {...common} />;
      case 'DAILY_SALES_CHART':
        return <DailySalesChartCard period={card.period ?? 'DAYS_7'} onPeriodChange={onPeriodChange} {...common} />;
      case 'CHANNEL_SALES_CHART':
        return <ChannelSalesChartCard period={card.period ?? 'DAYS_7'} onPeriodChange={onPeriodChange} {...common} />;
    }
  };

  const action =
    loadState !== 'ready' ? undefined : editing ? (
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
        {loadState === 'ready' && mounted && (
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
              <div key={card.type}>{renderCard(card)}</div>
            ))}
          </ReactGridLayout>
        )}
      </div>
    </PageContainer>
  );
}
