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
 * - **카드는 하나, 표도 하나다.** 마스터 상품은 표 안의 **묶음 머리줄**이고 그 아래가 판매 채널 줄이다.
 *   마스터만 글줄로 띄우고 채널만 표로 만들지 않는다(2026-09-23).
 * - 🔴 **판매 채널은 `master.channels` 로 그린다.** `usage.listingOptions`(옵션 FK 를 타고 내려온 목록)를
 *   쓰면 FK 가 비어 있는 셀 — 쿠팡 ID 로 편입했거나 FK 승격 전에 만들어진 셀 — 이 통째로 빠져
 *   **같은 마스터를 여러 채널에서 파는데 한 채널만 보인다**(2026-09-23 실제 발생).
 * - 🔴 **옵션 줄을 나열하지 않는다.** 마스터 옵션의 수량은 채널마다 같으므로 채널 줄의 「구성 수량」이
 *   그 자리를 대신한다.
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

import { Fragment } from 'react';
import Link from 'next/link';
import type {
  ProductUsage,
  ProductUsageChannel,
  ProductUsageMasterRef,
} from '@/domain/entities/ProductUsage';
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

/** 「6개입 ×6 · 12개입 ×12」. 옵션이 없으면 `-` */
function quantityText(master: ProductUsageMasterRef): string {
  if (master.optionQuantities.length === 0) return '-';
  return master.optionQuantities.map((q) => `${q.optionName} ×${q.quantity ?? '-'}`).join(' · ');
}

function statusText(status: string | null): string {
  if (!status) return '-';
  return STATUS_LABEL[status] ?? status;
}

export function ProductUsageSection({
  usage,
  isLoading,
  error,
  onRetry,
  compact = false,
}: ProductUsageSectionProps) {
  const masters = usage?.masterProducts ?? [];
  const channelCount = masters.reduce((sum, master) => sum + (master.channels?.length ?? 0), 0);
  const hasLinks = masters.length > 0 || (usage?.listingOptions.length ?? 0) > 0;
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
            마스터 상품 {masters.length}개 · 판매 채널 {channelCount}개
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

      {/* 좁은 폭(병합 화면)에서는 표 대신 쌓아 올린다. 표가 최소 폭 736px 라 2단에 들어가지 않는다. */}
      {masters.length > 0 &&
        (compact ? (
          <div className="space-y-3">
            {masters.map((master) => (
              <div key={master.id}>
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-sm font-medium text-gray-900">{master.name}</span>
                  <Link
                    href={ROUTES.MASTER_PRODUCT_DETAIL(master.id)}
                    className="shrink-0 text-xs text-blue-600 hover:underline"
                  >
                    마스터 상품 상세정보 →
                  </Link>
                </div>
                <CompactChannelList master={master} />
              </div>
            ))}
          </div>
        ) : (
          <div className="list-table-scroll">
            <table className="text-sm">
              <thead className="border-b border-gray-200 bg-gray-100">
                <tr className="text-left text-gray-600">
                  <th className="px-4 py-2">계정</th>
                  <th className="px-4 py-2">판매 상품</th>
                  <th className="px-4 py-2">구성 수량</th>
                  <th className="px-4 py-2">상태</th>
                  <th className="px-4 py-2" />
                </tr>
              </thead>
              <tbody>
                {masters.map((master) => {
                  const channels = master.channels ?? [];
                  return (
                    <Fragment key={master.id}>
                      {/* 마스터 = 묶음 머리줄. 아래 줄들이 이 마스터가 올라가 있는 판매 채널이다. */}
                      <tr className="border-b border-gray-200 bg-gray-50">
                        <td colSpan={5} className="px-4 py-2">
                          <div className="flex items-center justify-between gap-3">
                            <span className="font-semibold text-gray-900">{master.name}</span>
                            <Link
                              href={ROUTES.MASTER_PRODUCT_DETAIL(master.id)}
                              className="shrink-0 text-blue-600 hover:underline"
                            >
                              마스터 상품 상세정보 →
                            </Link>
                          </div>
                        </td>
                      </tr>
                      {channels.length === 0 ? (
                        <tr className="border-b border-gray-100">
                          <td colSpan={5} className="px-4 py-2 text-gray-400">
                            판매 채널 없음 · {quantityText(master)}
                          </td>
                        </tr>
                      ) : (
                        channels.map((channel) => (
                          <ChannelRow
                            key={channel.listingId}
                            channel={channel}
                            quantity={quantityText(master)}
                          />
                        ))
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        ))}
    </Card>
  );
}

/** 판매 채널 한 줄(표). */
function ChannelRow({ channel, quantity }: { channel: ProductUsageChannel; quantity: string }) {
  return (
    <tr className="border-b border-gray-100 last:border-b-0">
      <td className="px-4 py-2">
        <span className="rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-700">
          {channel.accountAlias ?? channel.platform}
        </span>
      </td>
      <td className="px-4 py-2 font-medium text-gray-900">
        {channel.listingName ?? '(이름 없음)'}
      </td>
      <td className="px-4 py-2 text-gray-700">{quantity}</td>
      <td className="px-4 py-2 text-gray-700">{statusText(channel.status)}</td>
      <td className="px-4 py-2 text-right">
        <Link
          href={ROUTES.SALES_PRODUCTS_RETRIEVE_DETAILS(channel.listingId)}
          className="shrink-0 text-blue-600 hover:underline"
        >
          판매 상품 상세정보 →
        </Link>
      </td>
    </tr>
  );
}

/** 병합 화면(좁은 폭)용 판매 채널 목록. */
function CompactChannelList({ master }: { master: ProductUsageMasterRef }) {
  const channels = master.channels ?? [];
  const quantity = quantityText(master);

  if (channels.length === 0) {
    return <p className="mt-1 text-xs text-gray-400">판매 채널 없음 · {quantity}</p>;
  }

  return (
    <ul className="mt-1 divide-y divide-gray-100 border-t border-gray-100">
      {channels.map((channel) => (
        <li key={channel.listingId} className="flex items-start justify-between gap-2 py-2">
          <div className="min-w-0">
            <p className="truncate text-xs font-medium text-gray-900">
              {channel.listingName ?? '(이름 없음)'}
            </p>
            <p className="text-xs text-gray-500">
              {channel.accountAlias ?? channel.platform} · {quantity} · {statusText(channel.status)}
            </p>
          </div>
          <Link
            href={ROUTES.SALES_PRODUCTS_RETRIEVE_DETAILS(channel.listingId)}
            className="shrink-0 text-xs text-blue-600 hover:underline"
          >
            판매 상품 상세정보 →
          </Link>
        </li>
      ))}
    </ul>
  );
}
