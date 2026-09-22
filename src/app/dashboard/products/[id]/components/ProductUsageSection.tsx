'use client';

/**
 * 물품이 팔리고 있는 곳 — 마스터 상품 / 판매 채널 (FEATURE_2609_69 / A).
 *
 * **용도**: "이 물품이 어디에 쓰이는지" 를 보여주고, 삭제하려면 어디로 가서 끊어야 하는지 안내한다.
 * **파일**: src/app/dashboard/products/[id]/components/ProductUsageSection.tsx
 *
 * **필수 규칙**
 * - 물품 상세(02)와 중복 병합 화면(04)이 **같은 컴포넌트를 쓴다.** 병합 화면은 좌우에 하나씩 놓으므로
 *   `compact` 를 켜서 좁은 폭에 맞춘다. 같은 화면을 다시 만들지 않는다.
 * - 조회·로딩·에러 상태는 이 컴포넌트가 만들지 않는다 — 부모(컨테이너)가 usecase 로 받아 props 로 준다.
 * - **카드는 하나다.** 요약·마스터 상품·판매 채널을 각각 카드로 쪼개지 않는다(2026-09-23).
 * - 🔴 **옵션 줄을 그대로 나열하지 않는다.** 서버는 셀 **옵션** 단위로 주지만 화면은 `listingId` 로 묶어
 *   **판매 채널(셀) 한 줄**로 접는다 — 옵션별 수량은 위 마스터 상품 줄에 이미 있다(2026-09-23).
 * - 쓰이는 곳 0 → `compact` 는 아무것도 렌더하지 않고(null), 상세 화면은 한 줄 안내만 남긴다.
 * - 이동 링크는 **상세 화면으로 보낸다.** 목록으로 보내면 사용자가 거기서 다시 찾아야 한다(2026-09-23).
 *
 * **사용 예제**
 * ```tsx
 * <ProductUsageSection usage={usage} isLoading={usageLoading} error={usageError} onRetry={loadUsage} />
 * <ProductUsageSection usage={left} isLoading={loading} error={error} onRetry={reload} compact />
 * ```
 *
 * ⚠️ 여기는 「끊으러 갈 곳」을 보여주는 화면이지 이관 대상 목록이 아니다. 연결을 끊는 기능을 넣지 않는다
 *    (마스터 상품 화면의 일이다).
 * ❌ 쓰이고 있다는 사실을 **빨간 경고로 칠하지 않는다.** 쓰이는 건 정상 상태다 — 빨강은 사용자가 무언가를
 *    눌러서 실제로 실패했을 때만 쓴다(2026-09-23).
 */

import Link from 'next/link';
import type { ProductUsage, ProductUsageListingOption } from '@/domain/entities/ProductUsage';
import { Card } from '@/presentation/components/ui/Card';
import { StateBlock } from '@/presentation/components/ui/StateBlock';
import { Button } from '@/presentation/components/ui/Button';
import { ROUTES } from '@/config/routes';

// 상태 enum → 화면 문구. ⚠️ enum 원문(`SELLING` 등)을 사용자에게 노출하지 않는다(UI 용어 규칙).
const STATUS_LABEL: Record<string, string> = {
  DRAFT: '미전송',
  SUBMITTED: '승인 대기중',
  SELLING: '판매중',
  REJECTED: '승인 반려',
  SUSPENDED: '판매 중지',
};

export interface ProductUsageSectionProps {
  usage: ProductUsage | null;
  isLoading: boolean;
  error: string | null;
  onRetry: () => void;
  /** true = 병합 화면에서 좌우 2단으로 쓸 때. 글씨·여백을 줄이고 표 대신 목록으로 쌓는다 */
  compact?: boolean;
}

/** 옵션 줄을 접어 만든 판매 채널 한 줄. */
interface UsageChannel {
  key: string;
  listingId: number | null;
  listingName: string | null;
  accountAlias: string | null;
  platform: string;
  status: string | null;
}

/**
 * 셀 **옵션** 목록 → **판매 채널(셀)** 목록.
 *
 * 🔴 옵션은 마스터 상품이 이미 갖고 있으므로 여기서 또 줄줄이 보여주지 않는다(2026-09-23).
 * 🔴 셀 id 가 없는 옛 줄은 **뭉치지 않는다** — 뭉치면 서로 다른 채널이 한 줄로 합쳐진다.
 */
function collapseToChannels(options: ProductUsageListingOption[]): UsageChannel[] {
  const byKey = new Map<string, UsageChannel>();
  for (const option of options) {
    const key = option.listingId == null ? `option:${option.id}` : `listing:${option.listingId}`;
    if (byKey.has(key)) continue;
    byKey.set(key, {
      key,
      listingId: option.listingId,
      listingName: option.listingName,
      accountAlias: option.accountAlias,
      platform: option.platform,
      status: option.status,
    });
  }
  return [...byKey.values()];
}

/**
 * 판매 상품 상세 주소.
 *
 * 🔴 서버가 셀 id 를 함께 주기 전에는 목록으로만 보낼 수 있었다(2026-09-23 해결).
 * 옛 데이터라 셀 id 가 없으면 그때만 목록으로 떨어뜨린다.
 */
function listingHref(listingId: number | null): string {
  return listingId == null
    ? ROUTES.SALES_PRODUCTS_RETRIEVE
    : ROUTES.SALES_PRODUCTS_RETRIEVE_DETAILS(listingId);
}

export function ProductUsageSection({
  usage,
  isLoading,
  error,
  onRetry,
  compact = false,
}: ProductUsageSectionProps) {
  const masters = usage?.masterProducts ?? [];
  const options = usage?.listingOptions ?? [];
  // 서버는 셀 옵션 단위로 준다 — 화면은 채널(셀) 단위로 접는다.
  const channels = collapseToChannels(options);
  const hasLinks = masters.length > 0 || channels.length > 0;
  const textSize = compact ? 'text-xs' : 'text-sm';

  if (isLoading) {
    return (
      <Card title={compact ? undefined : '판매 채널'}>
        <div className="space-y-3">
          <div className="h-4 w-32 animate-pulse rounded bg-gray-200" />
          <div className="h-4 w-full animate-pulse rounded bg-gray-100" />
          <div className="h-4 w-2/3 animate-pulse rounded bg-gray-100" />
        </div>
      </Card>
    );
  }

  if (error) {
    return (
      <Card padded={false}>
        <StateBlock variant="error" message="판매 채널을 불러오지 못했습니다." />
        <div className="flex justify-center pb-6">
          <Button variant="secondary" size="sm" onClick={onRetry}>
            다시 시도
          </Button>
        </div>
      </Card>
    );
  }

  // 병합 화면(좌우 2단)은 빈 칸을 남기지 않는다. 상세 화면은 「아직 팔지 않습니다」를 보여준다.
  if (!hasLinks && compact) return null;

  return (
    <Card
      title={compact ? undefined : '판매 채널'}
      action={
        hasLinks && !compact ? (
          <span className="text-sm text-gray-600">
            마스터 상품 {masters.length}개 · 판매 채널 {channels.length}개
          </span>
        ) : undefined
      }
      className="space-y-4"
    >
      {!hasLinks && (
        <p className="text-sm text-gray-500">이 물품은 아직 어디에서도 팔고 있지 않습니다.</p>
      )}

      {/* 쓰이고 있다는 사실 자체는 정상이다 — 회색 안내 한 줄로만 알린다.
          병합 화면(compact)은 부모 카드가 같은 안내를 이미 띄우므로 생략한다. */}
      {hasLinks && !compact && (
        <p className={`text-gray-600 ${textSize}`}>
          삭제하려면 마스터 상품에서 이 물품을 먼저 빼주세요. 그러면 아래 판매 채널에서도 함께 빠집니다.
        </p>
      )}

      {masters.length > 0 && (
        <section>
          <h3 className={`mb-2 font-semibold text-gray-900 ${compact ? 'text-xs' : 'text-sm'}`}>
            마스터 상품 {masters.length}개
          </h3>
          <ul className="space-y-3">
            {masters.map((master) => (
              <li key={master.id} className="border-b border-gray-100 pb-3 last:border-b-0 last:pb-0">
                <div className="flex items-center justify-between gap-3">
                  <span className={`font-medium text-gray-900 ${compact ? 'text-sm' : 'text-base'}`}>
                    {master.name}
                  </span>
                  <Link
                    href={ROUTES.MASTER_PRODUCT_DETAIL(master.id)}
                    className={`shrink-0 text-blue-600 hover:underline ${textSize}`}
                  >
                    마스터 상품 상세정보 →
                  </Link>
                </div>
                {/* 옵션 수량은 독립된 연결이 아니라 마스터 구성품의 수량이라 마스터 아래 접어서 보여준다. */}
                {master.optionQuantities.length > 0 && (
                  <p className={`mt-1 text-gray-600 ${textSize}`}>
                    └ 옵션별 수량:{' '}
                    {master.optionQuantities
                      .map((q) => `${q.optionName} ×${q.quantity ?? '-'}`)
                      .join(' · ')}
                  </p>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {channels.length > 0 && (
        <section>
          <h3 className={`mb-2 font-semibold text-gray-900 ${compact ? 'text-xs' : 'text-sm'}`}>
            판매 채널 {channels.length}개
          </h3>
          {compact ? (
            <ul className="divide-y divide-gray-100">
              {channels.map((channel) => (
                <li key={channel.key} className="flex items-start justify-between gap-2 py-2">
                  <div className="min-w-0">
                    <p className="truncate text-xs font-medium text-gray-900">
                      {channel.listingName ?? '(이름 없음)'}
                    </p>
                    <p className="text-xs text-gray-500">
                      {channel.accountAlias ?? channel.platform} ·{' '}
                      {channel.status ? (STATUS_LABEL[channel.status] ?? channel.status) : '-'}
                    </p>
                  </div>
                  <Link
                    href={listingHref(channel.listingId)}
                    className="shrink-0 text-xs text-blue-600 hover:underline"
                  >
                    판매 상품 상세정보 →
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <div className="list-table-scroll">
              <table className="text-sm">
                <thead className="border-b border-gray-200 bg-gray-100">
                  <tr className="text-left text-gray-600">
                    <th className="px-4 py-3">계정</th>
                    <th className="px-4 py-3">판매 상품</th>
                    <th className="px-4 py-3">상태</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {channels.map((channel) => (
                    <tr key={channel.key} className="border-b border-gray-100 last:border-b-0">
                      <td className="px-4 py-3">
                        <span className="rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-700">
                          {channel.accountAlias ?? channel.platform}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-medium text-gray-900">
                        {channel.listingName ?? '(이름 없음)'}
                      </td>
                      <td className="px-4 py-3 text-gray-700">
                        {channel.status ? (STATUS_LABEL[channel.status] ?? channel.status) : '-'}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Link
                          href={listingHref(channel.listingId)}
                          className="shrink-0 text-blue-600 hover:underline"
                        >
                          판매 상품 상세정보 →
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}
    </Card>
  );
}
