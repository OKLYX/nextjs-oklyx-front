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
 * - **마스터 상품이 묶음(부모), 판매 채널이 그 안의 줄(자식)이다.** 마스터마다 테두리 박스를 하나 두고
 *   그 안에 채널 줄을 깐다(2026-09-23). 마스터만 글줄로 띄우고 채널만 표로 만들지 않는다.
 * - 🔴 **판매 채널은 `master.channels` 로 그린다.** `usage.listingOptions`(옵션 FK 를 타고 내려온 목록)를
 *   쓰면 FK 가 비어 있는 셀 — 쿠팡 ID 로 편입했거나 FK 승격 전에 만들어진 셀 — 이 통째로 빠져
 *   **같은 마스터를 여러 채널에서 파는데 한 채널만 보인다**(2026-09-23 실제 발생).
 * - 🔴 **옵션 줄을 나열하지 않는다.** 마스터 옵션의 수량은 채널마다 같으므로 채널 줄의 「구성」이
 *   그 자리를 대신한다.
 * - 쓰이는 곳 0 → `compact` 는 아무것도 렌더하지 않고(null), 상세 화면은 한 줄 안내만 남긴다.
 * - 이동 링크는 **상세 화면으로 보낸다.** 목록으로 보내면 사용자가 거기서 다시 찾아야 한다(2026-09-23).
 * - 🔴 **배지 색은 다크모드가 리맵하는 팔레트(gray·red·blue·green·amber)만 쓴다.** `emerald`/`sky`/`rose`
 *   같은 색은 `globals.css` 의 `.dark` 블록에 매핑이 없어 어두운 배경에서 흰 배지로 남는다.
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
 *    눌러서 실제로 실패했을 때만 쓴다(2026-09-23). 삭제가 막혔다는 안내는 amber 안내 박스까지만.
 */

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

// 상태 enum → 화면 문구 + 배지 색. ⚠️ enum 원문(`SELLING` 등)을 사용자에게 노출하지 않는다(UI 용어 규칙).
const STATUS_META: Record<string, { label: string; className: string }> = {
  DRAFT: { label: '미전송', className: 'bg-gray-100 text-gray-600' },
  SUBMITTED: { label: '승인 대기중', className: 'bg-blue-50 text-blue-700' },
  SELLING: { label: '판매중', className: 'bg-green-50 text-green-700' },
  REJECTED: { label: '승인 반려', className: 'bg-red-50 text-red-700' },
  SUSPENDED: { label: '판매 중지', className: 'bg-gray-100 text-gray-600' },
};

// 플랫폼 코드 → 화면 문구 + 배지 색. 모르는 코드는 코드 원문 + 회색(두 번째 몰은 한 줄만 추가하면 된다).
const PLATFORM_META: Record<string, { label: string; className: string }> = {
  COUPANG: { label: '쿠팡', className: 'bg-red-50 text-red-700' },
  NAVER: { label: '네이버', className: 'bg-green-50 text-green-700' },
};

/** 채널·계정 | 판매 상품 | 구성 | 상태 | › — 좁은 화면(md 미만)에서는 한 줄씩 쌓는다 */
const ROW_GRID =
  'grid grid-cols-1 gap-1 md:grid-cols-[1.25rem_minmax(0,1.2fr)_minmax(0,2fr)_minmax(0,1fr)_6rem_1rem] md:items-center md:gap-3';

export interface ProductUsageSectionProps {
  usage: ProductUsage | null;
  isLoading: boolean;
  error: string | null;
  onRetry: () => void;
  /** true = 병합 화면에서 좌우 2단으로 쓸 때. 글씨·여백을 줄이고 묶음 박스 대신 목록으로 쌓는다 */
  compact?: boolean;
}

/** 「6개입 ×6 · 12개입 ×12」. 옵션이 없으면 `-` */
function quantityText(master: ProductUsageMasterRef): string {
  if (master.optionQuantities.length === 0) return '-';
  return master.optionQuantities.map((q) => `${q.optionName} ×${q.quantity ?? '-'}`).join(' · ');
}

function statusMeta(status: string | null): { label: string; className: string } {
  if (!status) return { label: '-', className: 'bg-gray-100 text-gray-600' };
  return STATUS_META[status] ?? { label: status, className: 'bg-gray-100 text-gray-600' };
}

function platformMeta(platform: string): { label: string; className: string } {
  return PLATFORM_META[platform] ?? { label: platform, className: 'bg-gray-100 text-gray-700' };
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
          <span className="shrink-0 text-sm text-gray-500">
            마스터 상품 {masters.length}개 · 판매 채널 {channelCount}개
          </span>
        ) : undefined
      }
      className="space-y-4"
    >
      {!hasLinks && (
        <p className="text-sm text-gray-500">이 물품은 아직 어디에서도 팔고 있지 않습니다.</p>
      )}

      {/* 삭제가 막힌 이유를 알려주는 안내 — 일반 설명이 아니라 「왜 삭제가 안 되는지」다.
          병합 화면(compact)은 부모 카드가 같은 안내를 이미 띄우므로 생략한다. */}
      {hasLinks && !compact && (
        <p className="flex gap-2 rounded-lg bg-amber-50 px-3 py-2.5 text-sm leading-relaxed text-amber-800">
          <span aria-hidden>ⓘ</span>
          <span>
            이 물품은 마스터 상품에 포함되어 있어 삭제할 수 없습니다. 마스터 상품에서 이 물품을 빼면
            아래 판매 채널에서도 함께 빠집니다.
          </span>
        </p>
      )}

      {/* 좁은 폭(병합 화면)에서는 묶음 박스 대신 쌓아 올린다. */}
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
          <div className="space-y-3">
            {masters.map((master) => (
              <MasterGroup key={master.id} master={master} />
            ))}
          </div>
        ))}
    </Card>
  );
}

/** 마스터 상품 한 묶음 = 머리줄(마스터) + 그 아래 채널 줄들. */
function MasterGroup({ master }: { master: ProductUsageMasterRef }) {
  const channels = master.channels ?? [];
  const quantity = quantityText(master);

  return (
    <div className="overflow-hidden rounded-lg border border-gray-200">
      {/* 부모: 마스터 상품 */}
      <div className="flex items-center gap-3 border-b border-gray-200 bg-gray-50 px-4 py-3">
        <div className="min-w-0 flex-1">
          <p className="text-xs text-gray-500">마스터 상품</p>
          <p className="truncate font-medium text-gray-900">{master.name}</p>
        </div>
        <span className="hidden shrink-0 text-xs text-gray-500 sm:block">
          판매 채널 {channels.length}개
        </span>
        <Link
          href={ROUTES.MASTER_PRODUCT_DETAIL(master.id)}
          className="shrink-0 rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-100"
        >
          상세 보기
        </Link>
      </div>

      {channels.length === 0 ? (
        <p className="px-4 py-4 text-sm text-gray-500">
          이 마스터 상품은 아직 어떤 채널에도 등록되지 않았습니다 · 구성 {quantity}
        </p>
      ) : (
        <>
          {/* 자식 컬럼 헤더 — 줄이 쌓이는 좁은 화면에서는 의미가 없어 숨긴다 */}
          <div className={`${ROW_GRID} hidden px-4 py-2 text-xs text-gray-400 md:grid`}>
            <span />
            <span>채널 · 계정</span>
            <span>판매 상품</span>
            <span>구성</span>
            <span>상태</span>
            <span />
          </div>

          {/* 자식: 채널별 판매 상품 (줄 전체가 링크) */}
          <ul>
            {channels.map((channel) => (
              <li key={channel.listingId} className="border-t border-gray-100">
                <ChannelRow channel={channel} quantity={quantity} />
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

/** 판매 채널 한 줄. 줄 전체가 판매 상품 상세로 가는 링크다. */
function ChannelRow({ channel, quantity }: { channel: ProductUsageChannel; quantity: string }) {
  const platform = platformMeta(channel.platform);
  const status = statusMeta(channel.status);

  return (
    <Link
      href={ROUTES.SALES_PRODUCTS_RETRIEVE_DETAILS(channel.listingId)}
      className={`${ROW_GRID} px-4 py-3 text-sm hover:bg-gray-50 focus-visible:bg-gray-50 focus-visible:outline-none`}
    >
      <span aria-hidden className="hidden text-gray-300 md:block">
        ↳
      </span>
      <span className="flex min-w-0 flex-col gap-0.5">
        <span className={`w-fit rounded px-2 py-0.5 text-xs ${platform.className}`}>
          {platform.label}
        </span>
        <span className="truncate text-xs text-gray-500">
          {channel.accountAlias ?? channel.platform}
        </span>
      </span>
      <span className="truncate font-medium text-gray-900">
        {channel.listingName ?? '(이름 없음)'}
      </span>
      <span className="truncate text-gray-600">{quantity}</span>
      <span className={`w-fit rounded-full px-2.5 py-0.5 text-xs ${status.className}`}>
        {status.label}
      </span>
      <span aria-hidden className="hidden text-gray-400 md:block">
        ›
      </span>
    </Link>
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
      {channels.map((channel) => {
        const platform = platformMeta(channel.platform);
        const status = statusMeta(channel.status);
        return (
          <li key={channel.listingId} className="flex items-start justify-between gap-2 py-2">
            <div className="min-w-0">
              <p className="truncate text-xs font-medium text-gray-900">
                {channel.listingName ?? '(이름 없음)'}
              </p>
              <p className="mt-0.5 flex flex-wrap items-center gap-1 text-xs text-gray-500">
                <span className={`rounded px-1.5 py-0.5 ${platform.className}`}>
                  {platform.label}
                </span>
                <span className="truncate">{channel.accountAlias ?? channel.platform}</span>
                <span>· {quantity} ·</span>
                <span className={`rounded-full px-2 py-0.5 ${status.className}`}>
                  {status.label}
                </span>
              </p>
            </div>
            <Link
              href={ROUTES.SALES_PRODUCTS_RETRIEVE_DETAILS(channel.listingId)}
              className="shrink-0 text-xs text-blue-600 hover:underline"
            >
              판매 상품 상세정보 →
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
