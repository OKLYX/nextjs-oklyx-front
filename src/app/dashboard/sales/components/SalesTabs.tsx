'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ROUTES } from '@/config/routes';

/**
 * 매출 화면 탭 (FEATURE_2609_30 / 04). 탭 = 라우트라 전환하면 각 화면이 자기 기간으로 다시 뜬다.
 *
 * ⚠️ 정산 내역(`ROUTES.SETTLEMENT_PAYOUTS`)은 여기 탭이 아니다 — 축(매출인식일)과 정본(쿠팡 배치)이
 * 달라서 한 화면에 섞으면 "어제 매출이 왜 바뀌었지"가 나온다(PLAN 2609_30 D2). 진입은 채널 행의
 * `[정산 내역 →]` 과 사이드바 메뉴로만 한다.
 */
const TABS: { href: string; label: string }[] = [
  { href: ROUTES.SALES_SUMMARY, label: '매출 조회' },
  { href: ROUTES.SALES_BY_PRODUCT, label: '상품별 매출' },
];

export function SalesTabs() {
  const pathname = usePathname();

  return (
    <div className="flex items-center gap-2 border-b border-gray-200">
      {TABS.map((tab) => {
        const isActive = pathname === tab.href;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`px-4 py-2 text-sm font-semibold border-b-2 -mb-px ${
              isActive
                ? 'border-blue-600 text-blue-700'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
    </div>
  );
}
