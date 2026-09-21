'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Button } from '@/presentation/components/ui/Button';
import { Input } from '@/presentation/components/ui/Input';
import { Spinner } from '@/presentation/components/Spinner';
import { extractErrorMessage } from '@/infrastructure/utils/errorMessage';
import { ChannelProductUseCase } from '@/application/usecases/ChannelProductUseCase';
import { ChannelProductRepositoryImpl } from '@/infrastructure/repositories/ChannelProductRepositoryImpl';
import { SellerUseCase } from '@/application/usecases/SellerUseCase';
import { SellerRepositoryImpl } from '@/infrastructure/repositories/SellerRepositoryImpl';
import type { Seller } from '@/domain/entities/SellerEntity';
import type {
  ChannelProductDetail,
  ChannelProductSummary,
} from '@/domain/entities/ChannelProductEntity';
import { useToolPanelStore } from '@/infrastructure/stores/toolPanelStore';
import { CLIP_MIME } from '@/domain/entities/ClipItem';
import { newClipId } from '@/infrastructure/stores/clipboardStore';
import { MarketImagePreviewModal } from './MarketImagePreviewModal';

/**
 * 전역 도구 패널의 도구 1개 — **플랫폼 상품 조회**(FEATURE_2609_67 · 2609_68 에서 전역으로 옮김).
 *
 * **용도**: 판매자의 마켓 상품을 이름 또는 상품 ID 로 찾아, 보면서 물품 등록 칸을 채운다.
 *   값은 전부 **사람이 버튼을 눌러야** 들어간다(자동 채우기 없음).
 * **파일**: src/app/dashboard/components/ChannelProductTool.tsx
 * **쓰는 곳**: `dashboard/layout.tsx` 의 `ToolPanel` 본문 **한 곳뿐**이다 — 도구는 화면에 속하지 않는다.
 *
 * **[채우기] 는 `toolPanelStore.fillTarget` 을 통해 나간다**: 값을 받을 화면(물품 등록 폼)이 마운트될
 *   때 손을 내밀고, 없으면(`fillTarget == null`) **버튼 자체를 그리지 않는다**. 값 줄은 그대로 보인다.
 *
 * ⚠️ 이 컴포넌트는 `<form>` 밖(전역 레이아웃)에 살지만, 버튼은 계속 `type="button"` 으로 두고
 *    검색 입력의 **Enter 가드**도 유지한다 — 어느 화면 위에 떠 있을지 알 수 없다.
 * ⚠️ 조회는 [조회] 를 누를 때만 나간다(타이핑 중 자동 검색 금지 — 쿠팡 호출 예산).
 * 🔴 사진은 **끌어서** 물품에 넣는다(담기 체크박스 없음, 2609_68). 드롭 지점은 상단바 클립보드와
 *    물품 이미지 등록 영역 두 곳이다. **누르면 확대**된다 — 브라우저가 클릭과 드래그를 가르므로
 *    거리·시간을 재는 코드를 만들지 않는다.
 * 🔴 마켓 URL 은 절대 주소다 — `resolveThumbUrl`·`getImageUrl` 을 태우면 404 가 난다.
 */

/** 오늘 지원하는 플랫폼은 쿠팡 하나다 — select 를 만들지 않는다. */
const PLATFORM = 'COUPANG';

// 상태 enum → 화면 문구(enum 원문을 사용자에게 노출하지 않는다). 마스터 생성 화면과 같은 한 줄짜리
// 표지만, 서로 import 하면 화면 간 결합이 생기므로 지역으로 둔다.
const STATUS_LABEL: Record<string, string> = {
  DRAFT: '미전송',
  SUBMITTED: '승인 대기중',
  SELLING: '판매중',
  REJECTED: '승인 반려',
  SUSPENDED: '판매 중지',
};

/** 폼 단위 select 와 **같은 표**다(G/KG/L/ML). 늘리지 말 것 — 폼과 어긋나면 저장이 막힌다. */
const UNIT_BY_SUFFIX: Record<string, string> = { g: 'G', kg: 'KG', l: 'L', ml: 'ML' };
const WITH_UNIT = /^\s*([0-9]+(?:\.[0-9]+)?)\s*(g|kg|l|ml)\s*$/i;
const NUMBER_ONLY = /^\s*([0-9]+(?:\.[0-9]+)?)\s*$/;

/**
 * 속성값 하나를 세 갈래로 가른다(PLAN/D7).
 *
 * 🔴 단위를 **추측해 넣지 않는다**. 어댑터는 접미사가 그 속성의 기본 단위와 같을 때만 떼어내므로
 * 쿠팡의 `"6개"` 가 여기엔 `"6"` 로 도착한다 — 단위를 `g` 로 단정하면 6개짜리가 조용히 6g 이 된다.
 */
type NetContentFill =
  | { kind: 'withUnit'; patch: { netContent: string; netContentUnit: string } }
  | { kind: 'numberOnly'; patch: { netContent: string } }
  | { kind: 'none' };

function netContentFillOf(value: string): NetContentFill {
  const withUnit = WITH_UNIT.exec(value);
  if (withUnit) {
    const unit = UNIT_BY_SUFFIX[withUnit[2].toLowerCase()];
    if (unit) {
      return { kind: 'withUnit', patch: { netContent: withUnit[1], netContentUnit: unit } };
    }
  }
  const numberOnly = NUMBER_ONLY.exec(value);
  if (numberOnly) return { kind: 'numberOnly', patch: { netContent: numberOnly[1] } };
  return { kind: 'none' };
}

/** 고시를 `키: 값` 줄로 이어 붙인다 — 설명 칸에 그대로 들어가는 문자열이다. */
function noticesToDescription(notices: Record<string, string>): string {
  return Object.entries(notices)
    .map(([key, value]) => `${key}: ${value}`)
    .join('\n');
}

const lookupErrorMessage = (e: unknown): string => {
  const status = (e as { response?: { status?: number } })?.response?.status;
  if (status === 429) return '잠시 후 다시 시도하세요.';
  return extractErrorMessage(e, '상품을 조회하지 못했습니다.');
};

export function ChannelProductTool() {
  /** 값을 받을 화면이 마운트돼 있을 때만 값이 있다. 없으면 [채우기] 버튼을 그리지 않는다. */
  const fillTarget = useToolPanelStore((s) => s.fillTarget);

  const channelUseCase = useMemo(
    () => new ChannelProductUseCase(new ChannelProductRepositoryImpl()),
    [],
  );
  const sellerUseCase = useMemo(() => new SellerUseCase(new SellerRepositoryImpl()), []);

  const [sellers, setSellers] = useState<Seller[]>([]);
  const [sellerId, setSellerId] = useState<number | ''>('');
  const [mode, setMode] = useState<'name' | 'id'>('name');
  const [query, setQuery] = useState('');
  const [looking, setLooking] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');
  const [candidates, setCandidates] = useState<ChannelProductSummary[] | null>(null);
  const [nextToken, setNextToken] = useState<string | null>(null);
  const [detail, setDetail] = useState<ChannelProductDetail | null>(null);
  /** 확대해서 보는 사진 URL. null = 닫힘. */
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const list = await sellerUseCase.getAll();
        if (alive) setSellers(list);
      } catch {
        if (alive) setError('판매자 목록을 불러오지 못했습니다.');
      }
    })();
    return () => {
      alive = false;
    };
  }, [sellerUseCase]);

  const trimmed = query.trim();
  const isLookupDisabled = sellerId === '' || trimmed === '' || looking;

  const loadDetail = useCallback(
    async (platformProductId: string) => {
      if (sellerId === '') return;
      setLooking(true);
      setError('');
      try {
        setDetail(await channelUseCase.detail(sellerId, PLATFORM, platformProductId));
      } catch (e: unknown) {
        setDetail(null);
        setError(lookupErrorMessage(e));
      } finally {
        setLooking(false);
      }
    },
    [channelUseCase, sellerId],
  );

  const handleLookup = useCallback(async () => {
    if (sellerId === '' || trimmed === '' || looking) return;
    setError('');
    setCandidates(null);
    setNextToken(null);
    setDetail(null);

    if (mode === 'id') {
      await loadDetail(trimmed);
      return;
    }

    setLooking(true);
    try {
      const res = await channelUseCase.search(sellerId, PLATFORM, trimmed);
      setCandidates(res.items);
      setNextToken(res.nextToken);
    } catch (e: unknown) {
      setError(lookupErrorMessage(e));
    } finally {
      setLooking(false);
    }
  }, [channelUseCase, loadDetail, looking, mode, sellerId, trimmed]);

  /** [더 보기] — 기존 목록에 덧붙인다(무한 스크롤 아님). */
  const handleMore = useCallback(async () => {
    if (sellerId === '' || nextToken == null || loadingMore) return;
    setLoadingMore(true);
    setError('');
    try {
      const res = await channelUseCase.search(sellerId, PLATFORM, trimmed, nextToken);
      setCandidates((prev) => [...(prev ?? []), ...res.items]);
      setNextToken(res.nextToken);
    } catch (e: unknown) {
      setError(lookupErrorMessage(e));
    } finally {
      setLoadingMore(false);
    }
  }, [channelUseCase, loadingMore, nextToken, sellerId, trimmed]);

  const description = detail ? noticesToDescription(detail.notices) : '';

  /**
   * 채우기 한 줄 — 값이 없으면 버튼만 비활성으로 두고 줄은 그대로 보여준다.
   * 🔴 받을 화면이 없으면(`fillTarget == null`) 버튼을 **아예 그리지 않는다**. 비활성으로 남겨두면
   *    "왜 안 눌리지" 가 된다.
   */
  const fillRow = (label: string, value: string | null, buttonLabel: string, onClick: () => void) => (
    <div className="flex items-start gap-2">
      <div className="min-w-0 flex-1">
        <p className="text-[11px] text-gray-500">{label}</p>
        <p className="break-words text-sm text-gray-900">{value || <span className="text-gray-400">(없음)</span>}</p>
      </div>
      {fillTarget && (
        <Button size="sm" variant="secondary" disabled={!value} onClick={onClick}>
          {buttonLabel}
        </Button>
      )}
    </div>
  );

  /**
   * 사진 하나를 끌 때 실어 보내는 payload — 격자와 확대 창이 **같은 손**을 쓴다.
   * 🔴 우리 서버 행이 아니라 마켓 URL 이므로 종류가 `market-image` 다(붙이는 경로가 다르다).
   */
  const startImageDrag = useCallback(
    (e: React.DragEvent, url: string, productName: string, platformProductId: string) => {
      const clip = {
        clipId: newClipId(),
        kind: 'market-image' as const,
        pickedAt: new Date().toISOString(),
        imageUrl: url,
        platformProductId,
        productName,
      };
      e.dataTransfer.setData(CLIP_MIME, JSON.stringify(clip));
      e.dataTransfer.effectAllowed = 'copy';
    },
    [],
  );

  /** 사진 격자 — 끌면 담기고, 누르면 확대된다. 마켓 URL 은 절대 주소라 프록시를 타지 않는다. */
  const imageGrid = (urls: string[], productName: string, platformProductId: string) => (
    <div className="grid grid-cols-3 gap-2">
      {urls.map((url) => (
        <button
          key={url}
          // 🔴 폼 밖이어도 유지 — 어느 화면 위에 떠 있을지 알 수 없다.
          type="button"
          draggable
          onDragStart={(e) => startImageDrag(e, url, productName, platformProductId)}
          onClick={() => setPreviewUrl(url)}
          className="aspect-square overflow-hidden rounded border border-gray-200 bg-gray-100 hover:border-blue-400"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={url} alt="마켓 사진" className="h-full w-full object-contain" />
        </button>
      ))}
    </div>
  );

  return (
    <div className="space-y-4">
      {/* ① 조회 줄 */}
      <div className="space-y-2">
        <select
          aria-label="판매자"
          className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm text-gray-900 disabled:bg-gray-100"
          value={sellerId}
          disabled={looking}
          onChange={(e) => setSellerId(e.target.value === '' ? '' : Number(e.target.value))}
        >
          <option value="">판매자를 선택하세요</option>
          {sellers.map((s) => (
            <option key={s.id} value={s.id}>
              {s.sellerName}
            </option>
          ))}
        </select>

        <div className="flex gap-3 text-xs text-gray-700">
          {(['name', 'id'] as const).map((value) => (
            <label key={value} className="flex cursor-pointer items-center gap-1">
              <input
                type="radio"
                name="channel-product-mode"
                checked={mode === value}
                onChange={() => {
                  setMode(value);
                  setQuery('');
                }}
              />
              {value === 'name' ? '상품명' : '상품 ID'}
            </label>
          ))}
        </div>

        <div className="flex items-start gap-2">
          <div className="min-w-0 flex-1">
            <Input
              size="sm"
              aria-label={mode === 'name' ? '상품명' : '상품 ID'}
              placeholder={mode === 'name' ? '상품명 일부' : '쿠팡 상품 ID'}
              inputMode={mode === 'name' ? 'text' : 'numeric'}
              // 🔴 쿠팡 검색어 제한 20자 — 잘라서 보내지 말고 입력을 막는다
              maxLength={mode === 'name' ? 20 : undefined}
              hint={mode === 'name' ? '20자까지' : undefined}
              value={query}
              disabled={looking}
              onChange={(e) =>
                setQuery(mode === 'name' ? e.target.value : e.target.value.replace(/[^0-9]/g, ''))
              }
              onKeyDown={(e) => {
                if (e.key !== 'Enter') return;
                e.preventDefault(); // 🔴 암묵적 제출 차단. 이 줄이 없으면 물품이 등록된다
                if (!isLookupDisabled) void handleLookup();
              }}
            />
          </div>
          <Button
            type="button"
            size="sm"
            disabled={isLookupDisabled}
            onClick={() => void handleLookup()}
          >
            {looking ? <Spinner label="조회 중…" /> : '조회'}
          </Button>
        </div>
      </div>

      {error && <p className="rounded bg-red-50 px-2 py-1.5 text-xs text-red-700">{error}</p>}

      {/* ② 후보 목록(상품명 모드) */}
      {candidates && (
        <div className="space-y-2">
          {candidates.length === 0 ? (
            <p className="text-xs text-gray-500">조회된 상품이 없습니다.</p>
          ) : (
            <div className="divide-y divide-gray-100 rounded border border-gray-200">
              {candidates.map((item) => (
                <button
                  key={item.platformProductId}
                  type="button"
                  onClick={() => void loadDetail(item.platformProductId)}
                  className="block w-full px-2 py-1.5 text-left hover:bg-gray-50"
                >
                  <p className="truncate text-sm text-gray-900">{item.productName ?? '(이름 없음)'}</p>
                  <p className="truncate text-[11px] text-gray-500">
                    {item.brand ?? '브랜드 없음'} · {STATUS_LABEL[item.status] ?? item.status}
                    {item.createdAt && ` · ${item.createdAt.slice(0, 10)}`}
                  </p>
                </button>
              ))}
            </div>
          )}
          {nextToken != null && (
            <Button size="sm" variant="secondary" disabled={loadingMore} onClick={() => void handleMore()}>
              {loadingMore ? <Spinner label="불러오는 중…" /> : '더 보기'}
            </Button>
          )}
        </div>
      )}

      {/* ③ 고른 상품 한 건 */}
      {detail && (
        <div className="space-y-4 border-t border-gray-200 pt-3">
          <p className="text-[11px] text-gray-500">
            상품 ID {detail.platformProductId} · {STATUS_LABEL[detail.status] ?? detail.status}
            {detail.categoryCode && ` · 카테고리 코드 ${detail.categoryCode}`}
          </p>

          {fillRow('상품명', detail.productName, '상품명 채우기', () =>
            fillTarget?.({ productName: detail.productName ?? '' }),
          )}
          {fillRow('브랜드', detail.brand, '브랜드 채우기', () =>
            fillTarget?.({ brand: detail.brand ?? '' }),
          )}
          {fillRow(
            `설명 (고시${detail.noticeGroup ? ` · ${detail.noticeGroup}` : ''})`,
            description,
            '설명 채우기',
            () => fillTarget?.({ description }),
          )}

          {/* 옵션 — 옵션명과 옵션 속성(용량)은 옵션마다 다르다 */}
          <div className="space-y-3">
            <p className="text-xs font-semibold text-gray-900">옵션 {detail.options.length}개</p>
            {detail.options.map((option, index) => (
              <div key={`${option.itemName ?? 'option'}-${index}`} className="space-y-2 rounded border border-gray-200 p-2">
                {fillRow('옵션명', option.itemName, '이 이름으로', () =>
                  fillTarget?.({ productName: option.itemName ?? '' }),
                )}
                <p className="text-[11px] text-gray-500">
                  판매가 {option.salePrice != null ? `${option.salePrice.toLocaleString()}원` : '-'} · 재고{' '}
                  {option.stockQuantity ?? '-'}
                </p>
                {Object.entries(option.attributes).map(([name, value]) => {
                  const fill = netContentFillOf(value);
                  return (
                    <div key={name} className="flex items-start gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="text-[11px] text-gray-500">{name}</p>
                        <p className="break-words text-sm text-gray-900">{value}</p>
                        {fill.kind === 'numberOnly' && (
                          <p className="text-[11px] text-gray-500">단위는 직접 고르세요</p>
                        )}
                      </div>
                      {fillTarget && (
                        <Button
                          size="sm"
                          variant="secondary"
                          disabled={fill.kind === 'none'}
                          onClick={() => {
                            if (fill.kind === 'none') return;
                            fillTarget(fill.patch);
                          }}
                        >
                          {fill.kind === 'withUnit' ? '양·단위 채우기' : '양만 채우기'}
                        </Button>
                      )}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>

          {/* 사진 — 두 묶음을 나눠서 그린다(가공본과 제품 사진을 구분해야 한다) */}
          <div className="space-y-2">
            <p className="text-xs font-semibold text-gray-900">대표 사진</p>
            <p className="text-[11px] text-gray-500">마켓 가공본입니다(문구·테두리가 얹혀 있을 수 있음)</p>
            {detail.thumbnailImages.length === 0 ? (
              <p className="text-xs text-gray-500">사진이 없습니다.</p>
            ) : (
              imageGrid(detail.thumbnailImages, detail.productName ?? '', detail.platformProductId)
            )}
          </div>
          <div className="space-y-2">
            <p className="text-xs font-semibold text-gray-900">상세 사진</p>
            <p className="text-[11px] text-gray-500">원본에 가까운 사진입니다</p>
            {detail.detailImages.length === 0 ? (
              <p className="text-xs text-gray-500">사진이 없습니다.</p>
            ) : (
              imageGrid(detail.detailImages, detail.productName ?? '', detail.platformProductId)
            )}
          </div>
        </div>
      )}

      {candidates == null && detail == null && !looking && (
        <p className="text-[11px] text-gray-500">
          판매자를 고르고 상품명 또는 상품 ID 로 [조회] 하면 마켓 값과 사진을 여기서 보면서 채울 수 있습니다.
        </p>
      )}

      {/* 🔴 모달은 격자마다가 아니라 도구 전체에 하나다. */}
      <MarketImagePreviewModal
        url={previewUrl}
        onClose={() => setPreviewUrl(null)}
        onDragStart={(e, url) =>
          startImageDrag(e, url, detail?.productName ?? '', detail?.platformProductId ?? '')
        }
      />
    </div>
  );
}
