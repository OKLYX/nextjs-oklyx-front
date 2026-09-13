'use client';

import { useEffect, useMemo, useState } from 'react';
import { PageContainer } from '@/presentation/components/PageContainer';
import { SellerUseCase } from '@/application/usecases/SellerUseCase';
import { SellerRepositoryImpl } from '@/infrastructure/repositories/SellerRepositoryImpl';
import type { Seller } from '@/domain/entities/SellerEntity';
import { RepricingTabs, type RepricingTab } from './components/RepricingTabs';
import { RepricingAlertTab } from './components/RepricingAlertTab';
import { RepricingHistoryTab } from './components/RepricingHistoryTab';

/**
 * 판매가 관리 페이지 — 탭 2개(FEATURE_2609_43 / PLAN D9).
 * File: src/app/dashboard/listings/repricing/page.tsx
 *
 * - 「판매가 주의 물품」 = 마진 경보 목록 + 재계산·마켓 반영 (2609_39·42·43)
 * - 「판매가 조정 내역」 = 판매가가 움직인 기록 (기존 `GET /api/admin/price-history`)
 *
 * 🔴 페이지가 직접 소유하는 것은 **탭 · 공용 필터(판매자·채널) · 판매자 목록** 뿐이다.
 *    조회·실행·상태는 각 탭 컴포넌트가 자기 것만 들고 있다 — 한쪽 탭의 데이터를 다른 탭이 재사용하지 않는다.
 * 🔴 판매자·채널을 여기에 둔 이유: 탭을 옮겨도 고른 판매자가 유지되어야 한다. 범위(대응 필요만/전체)는
 *    경보 탭 전용이라 그 컴포넌트가 들고 있다.
 * 🔴 탭 전환 = 그 탭의 **재마운트**다(조회를 새로 한다). 경보 탭의 「방금 처리함」 표시는 그래서 탭을 옮기면
 *    비워지는데, 그 기록은 이력 탭에 남아 있다.
 */
export default function ListingsRepricingPage() {
  const sellerUseCase = useMemo(() => new SellerUseCase(new SellerRepositoryImpl()), []);

  const [tab, setTab] = useState<RepricingTab>('ALERT');
  const [sellers, setSellers] = useState<Seller[]>([]);
  const [sellerId, setSellerId] = useState<number | ''>('');
  const [platform, setPlatform] = useState('');
  /** 활성 탭이 조회·실행 중인지. 탭 버튼 이중 클릭을 막는 데만 쓴다 */
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const list = await sellerUseCase.getAll();
        if (alive) setSellers(list);
      } catch {
        // 판매자 목록 실패는 필터만 비게 두고 본 목록 조회는 계속한다.
      }
    })();
    return () => {
      alive = false;
    };
  }, [sellerUseCase]);

  const changeTab = (next: RepricingTab) => {
    // 새 탭이 자기 조회를 시작하며 다시 알려준다 — 떠난 탭의 잠금을 남겨 두지 않는다.
    setBusy(false);
    setTab(next);
  };

  return (
    <PageContainer title="판매가 관리">
      <RepricingTabs value={tab} onChange={changeTab} disabled={busy} />

      {tab === 'ALERT' ? (
        <RepricingAlertTab
          sellers={sellers}
          sellerId={sellerId}
          platform={platform}
          onSellerChange={setSellerId}
          onPlatformChange={setPlatform}
          onBusyChange={setBusy}
        />
      ) : (
        <RepricingHistoryTab
          sellers={sellers}
          sellerId={sellerId}
          platform={platform}
          onSellerChange={setSellerId}
          onPlatformChange={setPlatform}
          onBusyChange={setBusy}
        />
      )}
    </PageContainer>
  );
}
