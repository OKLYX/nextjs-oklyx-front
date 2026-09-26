'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import axios from 'axios';
import { MoreHorizontal } from 'lucide-react';
import { Spinner } from '@/presentation/components/Spinner';
import { ConfirmDialog } from '@/presentation/components/ui/ConfirmDialog';
import { ROUTES } from '@/config/routes';
import { ListingRegistrationUseCase } from '@/application/usecases/ListingRegistrationUseCase';
import { ListingRegistrationRepositoryImpl } from '@/infrastructure/repositories/ListingRegistrationRepositoryImpl';
import { ChannelFieldValuesModal } from './ChannelFieldValuesModal';
import { ChannelStockModal } from './ChannelStockModal';
import { ChannelPriceModal } from './ChannelPriceModal';
import { ChannelOptionNameModal } from './ChannelOptionNameModal';
import { ChannelShippingOverrideModal } from './ChannelShippingOverrideModal';
import type { MasterOptionResponse } from '@/domain/entities/MasterProductEntity';
import type {
  ListingStatus,
  ListingStatusResponse,
  GeneratedProductResponse,
} from '@/domain/entities/ListingRegistrationEntity';
import type { ShippingUseCase } from '@/application/usecases/ShippingUseCase';

interface CellListing {
  id: number;
  status: ListingStatus;
}

/**
 * 해제·삭제 대상이 되는 셀 한 줄(2609_63/D10-1). 매트릭스의 `MatrixCell` 중 이 컴포넌트가 쓰는 두 값만 받는다.
 */
interface CellRef {
  productListingId: number;
  platformProductId: string | null;
}

interface CellActionsProps {
  masterId: number;
  listing: CellListing;
  options: MasterOptionResponse[];
  onReload: () => void;
  // Channel shipping override (75): the cell's account + current override for the modal.
  accountId: number;
  platform: string;
  channelLabel: string;
  shippingOverride: Record<string, string> | null | undefined;
  // Backend-resolved shipping readiness (77). false = [마켓 등록] 가드(비활성 + 사유).
  // null/undefined(미지원 플랫폼·레거시) = 가드 안 함 — 백엔드 400 이 최종 방어.
  shippingReady: boolean | null | undefined;
  shippingUseCase: ShippingUseCase; // parent-owned lookup (outbound/return)
  onShippingSaved: (updated: GeneratedProductResponse) => void;
  // 채널 카테고리(2609_45/D13). 서버 판정 그대로 — false 면 버튼을 렌더하지 않는다(되돌리는 방향은 400).
  usesOwnCategory: boolean;
  channelCategoryLabel: string | null; // categoryName ?? categoryCode (둘 다 없으면 null)
  masterCategoryName: string | null;
  /**
   * 이 계정의 **모든** 셀(2609_63/D10-1). 상품 ID 열(`CoverageMatrix.tsx`)이 나열하는 것과 같은 목록이다.
   * 🔴 해제·삭제만 이것을 읽는다 — 나머지 액션은 첫 셀(`listing`) 계약 그대로다(2609_61/D5).
   *    첫 셀에만 해제 버튼을 달면 잘못 붙은 게 두 번째 셀일 때 영영 떼지 못한다.
   */
  cells: CellRef[];
  /** 해제·삭제 성공 시 부모가 배너를 띄우고 다시 읽는다(두 동작 공용). */
  onCellRemoved: (message: string) => void;
  /** 로컬 변경이 마켓에 아직 안 갔다(`MatrixCell.needsMarketSync === true`) → [수정 요청]이 주 버튼. */
  needsMarketSync: boolean;
}

interface MenuItem {
  key: string;
  label: string;
  onClick?: () => void;
  /** 있으면 새 탭 링크로 연다(onClick 무시). */
  href?: string;
}

interface MenuGroup {
  label: string;
  items: MenuItem[];
}

/**
 * [쿠팡에서 보기] = WING 의 판매자 상품 화면. `platformProductId` 는 쿠팡 sellerProductId 다
 * (구매자용 상품 페이지 id 가 아니다 — 그 값은 저장하지 않는다).
 * ⚠️ 주소 형식은 실계정으로 확인하지 않았다 — 틀리면 이 함수 한 곳만 고친다.
 */
const coupangWingUrl = (sellerProductId: string) =>
  `https://wing.coupang.com/tenants/seller-web/vendor-inventory/modify?vendorInventoryId=${encodeURIComponent(
    sellerProductId,
  )}`;

type Busy =
  | 'register'
  | 'fetch'
  | 'regenerate'
  | 'update'
  | 'category-source'
  | 'unlink'
  | 'delete-cell'
  | null;

/**
 * 판매상품(셀) 한 줄의 액션 = **주 버튼 하나 + ⋯ 메뉴**.
 * File: src/app/dashboard/master-products/[id]/components/CellActions.tsx
 *
 * - 주 버튼: 미전송(DRAFT) = [마켓 등록] · 변경 미반영(`needsMarketSync`) = [수정 요청] · 그 외 없음.
 * - ⋯ 메뉴: 편집(필드값·상세·가격·재고·옵션명·배송) / 동기화(수정 요청·승인 새로고침·재생성) /
 *   연결(쿠팡에서 보기·마스터 카테고리로 변경) / 구분선 아래 빨간 [마스터 연결 해제]·[채널 삭제].
 * - 결과 알림(성공·실패·승인 결과)은 행 아래 한 줄(`basis-full`)로 나온다 — 부모 행이 flex-wrap 이어야 한다.
 *
 * 마켓 호출은 비동기(즉시 반환) — 승인은 이후 [승인 새로고침]으로 확인.
 * [수정 요청](109): 등록된 셀(DRAFT 아님)의 현재 값을 마켓에 강제 재전송 → 재심사(SUBMITTED).
 * ⚠️ 동작(핸들러·확인창·모달)은 버튼 줄 시절과 같다 — 바뀐 것은 위치와 묶음뿐이다.
 */
export function CellActions({
  masterId,
  listing,
  options,
  onReload,
  accountId,
  platform,
  channelLabel,
  shippingOverride,
  shippingReady,
  shippingUseCase,
  onShippingSaved,
  usesOwnCategory,
  channelCategoryLabel,
  masterCategoryName,
  cells,
  onCellRemoved,
  needsMarketSync,
}: CellActionsProps) {
  const router = useRouter();
  const useCase = useMemo(
    () => new ListingRegistrationUseCase(new ListingRegistrationRepositoryImpl()),
    [],
  );

  const [busy, setBusy] = useState<Busy>(null);
  const [error, setError] = useState('');
  const [statusResult, setStatusResult] = useState<ListingStatusResponse | null>(null);
  // [수정 요청] success notice (109). Cleared whenever another action starts.
  const [pushedBanner, setPushedBanner] = useState('');
  const [showFieldValues, setShowFieldValues] = useState(false);
  const [showShipping, setShowShipping] = useState(false);
  const [showStock, setShowStock] = useState(false);
  const [showPrice, setShowPrice] = useState(false);
  const [showOptionName, setShowOptionName] = useState(false);
  const [showCategorySource, setShowCategorySource] = useState(false);
  // 2609_63: boolean 이 아니라 **대상 셀**을 담는다 — 한 계정에 셀이 여럿일 수 있어(D10-1)
  // "열려 있다"만으로는 어느 셀을 떼는지 알 수 없다.
  const [unlinkTarget, setUnlinkTarget] = useState<CellRef | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<CellRef | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // 바깥 클릭·Esc 로 메뉴를 닫는다. 닫혀 있을 때는 리스너를 걸지 않는다.
  useEffect(() => {
    if (!menuOpen) return;
    const onMouseDown = (event: MouseEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) setMenuOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMenuOpen(false);
    };
    document.addEventListener('mousedown', onMouseDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onMouseDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [menuOpen]);

  const optionName = (id: number) => options.find((o) => o.id === id)?.name ?? `옵션 #${id}`;

  const run = async (kind: Exclude<Busy, null>, fn: () => Promise<void>) => {
    setBusy(kind);
    setError('');
    setPushedBanner('');
    try {
      await fn();
    } catch {
      setError('요청에 실패했습니다.');
    } finally {
      setBusy(null);
    }
  };

  const handleRegister = () =>
    run('register', async () => {
      await useCase.register(listing.id);
      onReload();
    });

  // Forced re-push of an already-registered cell (109). Not routed through run():
  // the backend's 400 message (미등록 / 비활성 계정 / 자동생성 먼저 / 활성 옵션 없음)
  // must surface as-is, and run() overwrites every failure with a fixed string.
  const handleUpdateRequest = async () => {
    if (!window.confirm('수정한 값을 마켓에 다시 보내고 재심사를 요청합니다. 계속하시겠습니까?')) return;
    setBusy('update');
    setError('');
    setPushedBanner('');
    try {
      await useCase.updateRequest(listing.id); // response unused: the reload is the source of truth
      setPushedBanner('승인 대기중으로 전환됨');
      setStatusResult(null); // the previous fetch-status result is stale now
      onReload();
    } catch (e) {
      const msg = axios.isAxiosError(e) ? e.response?.data?.message : undefined;
      setError(msg ?? '수정 요청에 실패했습니다.');
    } finally {
      setBusy(null);
    }
  };

  // 채널 카테고리 → 마스터 카테고리(2609_45/D13). handleUpdateRequest 와 같은 이유로 run() 을 타지
  // 않는다: 백엔드가 내려주는 사유(이미 마스터를 따름 / 미지원 등)를 그대로 보여줘야 한다.
  const handleCategorySource = async () => {
    setBusy('category-source');
    setError('');
    setPushedBanner('');
    try {
      await useCase.setCategorySource(listing.id, true);
      setShowCategorySource(false);
      setPushedBanner('마스터 카테고리로 변경했습니다. 다음 수정 요청 때 쿠팡에 반영됩니다.');
      onReload();
    } catch (e) {
      const msg = axios.isAxiosError(e) ? e.response?.data?.message : undefined;
      setShowCategorySource(false);
      setError(msg ?? '마스터 카테고리로 변경하지 못했습니다.');
    } finally {
      setBusy(null);
    }
  };

  // 마스터 연결 해제(2609_63/D3). handleCategorySource 와 같은 이유로 run() 을 타지 않는다:
  // 백엔드 400 사유(이 마스터의 채널이 아닙니다 / 마켓에 등록되지 않은 채널…)를 그대로 보여줘야 한다.
  // 🔴 대상은 `listing.id`(첫 셀)가 아니라 버튼이 넘긴 `cell.productListingId` 다.
  // 성공 문구는 부모가 소유한다 — 다시 읽으면 이 액션 영역 자체가 사라져 여기 띄운 문구도 같이 사라진다.
  const handleUnlink = async (cell: CellRef) => {
    setBusy('unlink');
    setError('');
    setPushedBanner('');
    try {
      await useCase.unlinkChannel(masterId, cell.productListingId);
      setUnlinkTarget(null);
      onCellRemoved(
        '마스터 연결을 해제했습니다. 판매상품 목록의 「마스터 미연결만」에서 볼 수 있습니다.',
      );
    } catch (e) {
      const msg = axios.isAxiosError(e) ? e.response?.data?.message : undefined;
      setUnlinkTarget(null);
      setError(msg ?? '마스터 연결을 해제하지 못했습니다.');
    } finally {
      setBusy(null);
    }
  };

  // 미전송 채널 삭제(2609_63/D13). ⚠️ 해제와 합치지 않는다 — 확인창·문구·백엔드 경로가 다르다.
  const handleDeleteCell = async (cell: CellRef) => {
    setBusy('delete-cell');
    setError('');
    setPushedBanner('');
    try {
      await useCase.deleteDraftChannel(masterId, cell.productListingId);
      setDeleteTarget(null);
      onCellRemoved('채널을 삭제했습니다.');
    } catch (e) {
      const msg = axios.isAxiosError(e) ? e.response?.data?.message : undefined;
      setDeleteTarget(null);
      setError(msg ?? '채널을 삭제하지 못했습니다.');
    } finally {
      setBusy(null);
    }
  };

  const handleFetch = () =>
    run('fetch', async () => {
      const res = await useCase.fetchStatus(listing.id);
      setStatusResult(res);
      onReload();
    });

  const handleRegenerate = () =>
    run('regenerate', async () => {
      await useCase.regenerate(listing.id);
      onReload();
    });

  // The fetch-status result (when present) is fresher than the matrix value until the reload lands.
  const status: ListingStatus = statusResult?.status ?? listing.status;

  // This channel has a stored shipping override → mark the menu item.
  const hasShippingOverride = !!shippingOverride && Object.keys(shippingOverride).length > 0;

  // Guard the register action only (77). Strict false — undefined/null means "not judged" → allow.
  const shippingBlocked = shippingReady === false;
  const shippingBlockedReason = '배송 설정 미완료 — 마스터/채널/계정 중 한 곳에서 배송 설정 필요';

  // 주 버튼은 상태에 따라 **하나만**: 미전송 = [마켓 등록], 변경 미반영 = [수정 요청], 그 외 = 없음.
  // 나머지 동작은 전부 ⋯ 메뉴로 간다(동작 자체는 무변경 — 위치와 묶음만 바뀌었다).
  const primary: 'register' | 'update' | null =
    status === 'DRAFT' ? 'register' : needsMarketSync ? 'update' : null;

  const menuGroups: MenuGroup[] = [
    {
      label: '편집',
      items: [
        { key: 'fields', label: '필드값 편집', onClick: () => setShowFieldValues(true) },
        {
          key: 'detail',
          label: '상세 편집',
          onClick: () => router.push(ROUTES.MASTER_PRODUCT_DETAIL_EDIT(masterId, listing.id)),
        },
        // 판매가·재고·옵션명은 등록 전에도 정해두는 값이라 DRAFT 를 포함한 모든 셀에서 노출한다
        // (2609_19 / 103/D3 / 2609_22/D23).
        { key: 'price', label: '가격 설정', onClick: () => setShowPrice(true) },
        { key: 'stock', label: '재고 설정', onClick: () => setShowStock(true) },
        { key: 'option-name', label: '옵션명', onClick: () => setShowOptionName(true) },
        {
          key: 'shipping',
          label: `채널 배송 설정${hasShippingOverride ? ' ✓' : ''}`,
          onClick: () => setShowShipping(true),
        },
      ],
    },
    {
      label: '동기화',
      items: [
        ...(status !== 'DRAFT' && primary !== 'update'
          ? [{ key: 'update', label: '수정 요청', onClick: handleUpdateRequest }]
          : []),
        // ⚠️ 반려는 막다른 길이 아니라 재확인이 가능해야 한다 → REJECTED 에도 노출.
        ...(status === 'SUBMITTED' || status === 'SELLING' || status === 'REJECTED'
          ? [{ key: 'fetch', label: '승인 새로고침', onClick: handleFetch }]
          : []),
        ...(status === 'SELLING'
          ? [{ key: 'regenerate', label: '재생성', onClick: handleRegenerate }]
          : []),
      ],
    },
    {
      label: '연결',
      items: [
        ...cells
          .filter((c) => platform === 'COUPANG' && c.platformProductId)
          .map((c) => ({
            key: `market-${c.productListingId}`,
            label: '쿠팡에서 보기',
            href: coupangWingUrl(c.platformProductId!),
          })),
        // 채널이 자기 카테고리를 쓰는 셀에만(2609_45/D13). 마스터 → 채널 방향은 없다.
        ...(usesOwnCategory
          ? [
              {
                key: 'category-source',
                label: '마스터 카테고리로 변경',
                onClick: () => setShowCategorySource(true),
              },
            ]
          : []),
      ],
    },
  ];

  // 2609_63: 파괴적 조작은 구분선 아래 빨간색. 마켓 상품 ID 가 있으면 [마스터 연결 해제],
  // 없으면(미전송) [채널 삭제] — 한 셀에 둘이 동시에 보이는 일은 없다.
  const dangerItems: MenuItem[] = cells.map((c) =>
    c.platformProductId
      ? {
          key: `unlink-${c.productListingId}`,
          label: `마스터 연결 해제${cells.length > 1 ? ` · ${c.platformProductId}` : ''}`,
          onClick: () => setUnlinkTarget(c),
        }
      : {
          key: `delete-${c.productListingId}`,
          label: `채널 삭제${cells.length > 1 ? ' · 미전송' : ''}`,
          onClick: () => setDeleteTarget(c),
        },
  );

  const runMenuItem = (item: MenuItem) => {
    setMenuOpen(false);
    item.onClick?.();
  };

  const hasFeedback =
    (status === 'DRAFT' && shippingBlocked) || !!pushedBanner || !!statusResult || !!error;

  return (
    // `contents` = 액션 묶음과 알림 줄이 부모(판매상품 행)의 flex 흐름에 그대로 들어간다 —
    // 액션은 행 오른쪽 끝, 알림 줄은 `basis-full` 로 행 아래 한 줄을 차지한다.
    <div className="contents">
      <div className="flex shrink-0 items-center gap-1.5">
        {primary === 'register' && (
          <button
            type="button"
            onClick={handleRegister}
            disabled={busy !== null || shippingBlocked}
            title={shippingBlocked ? shippingBlockedReason : undefined}
            className="flex items-center gap-1 rounded border border-blue-300 px-2 py-1 text-xs font-medium text-blue-700 hover:bg-blue-50 disabled:opacity-50"
          >
            {busy === 'register' ? <Spinner size={12} label="요청 중..." /> : '마켓 등록'}
          </button>
        )}
        {primary === 'update' && (
          <button
            type="button"
            onClick={handleUpdateRequest}
            disabled={busy !== null}
            className="flex items-center gap-1 rounded border border-amber-300 px-2 py-1 text-xs font-medium text-amber-700 hover:bg-amber-50 disabled:opacity-50"
          >
            {busy === 'update' ? <Spinner size={12} label="요청 중..." /> : '수정 요청'}
          </button>
        )}

        <div ref={menuRef} className="relative">
          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            disabled={busy !== null}
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            aria-label="더 보기"
            className="flex h-7 w-7 items-center justify-center rounded border border-gray-300 text-gray-600 hover:bg-gray-100 disabled:opacity-50"
          >
            {busy !== null && busy !== primary ? <Spinner size={12} /> : <MoreHorizontal size={16} />}
          </button>
          {/* 드롭다운은 팝업이 아니다(백드롭·작성 중 확인 없음) → `ui/Modal` 대신 말풍선 층(z-30).
              바깥 클릭·Esc 로 닫는다(`AlertBell` 과 같은 규칙). */}
          {menuOpen && (
            <div
              role="menu"
              className="absolute right-0 top-full z-30 mt-1 w-48 rounded-lg border border-gray-200 bg-white py-1 text-left shadow-lg"
            >
              {menuGroups
                .filter((g) => g.items.length > 0)
                .map((group) => (
                  <div key={group.label} className="py-1">
                    <p className="px-3 pb-0.5 text-[10px] font-semibold text-gray-400">
                      {group.label}
                    </p>
                    {group.items.map((item) =>
                      item.href ? (
                        <a
                          key={item.key}
                          role="menuitem"
                          href={item.href}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={() => setMenuOpen(false)}
                          className="block px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-100"
                        >
                          {item.label} ↗
                        </a>
                      ) : (
                        <button
                          key={item.key}
                          type="button"
                          role="menuitem"
                          onClick={() => runMenuItem(item)}
                          className="block w-full px-3 py-1.5 text-left text-xs text-gray-700 hover:bg-gray-100"
                        >
                          {item.label}
                        </button>
                      ),
                    )}
                  </div>
                ))}
              {dangerItems.length > 0 && (
                <div className="border-t border-gray-200 py-1">
                  {dangerItems.map((item) => (
                    <button
                      key={item.key}
                      type="button"
                      role="menuitem"
                      onClick={() => runMenuItem(item)}
                      className="block w-full px-3 py-1.5 text-left text-xs font-medium text-red-600 hover:bg-red-50"
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {hasFeedback && (
        <div className="basis-full space-y-1 pl-9">
          {/* disabled 버튼의 title 은 hover 가 안 뜨는 브라우저가 있어 보이는 안내 1줄을 함께 둔다. */}
          {status === 'DRAFT' && shippingBlocked && (
            <p className="text-[11px] text-gray-500">{shippingBlockedReason}</p>
          )}
          {pushedBanner && <p className="text-[11px] text-green-700">{pushedBanner}</p>}
          {statusResult && (
            <div className="flex flex-wrap items-center gap-1">
              {statusResult.status === 'SELLING' && (
                <span className="text-[11px] text-green-700">판매중으로 전환됨</span>
              )}
              {statusResult.options.map((o) => (
                <span
                  key={o.optionId}
                  className={`rounded px-1.5 py-0.5 text-[10px] ${
                    o.approvalStatus === 'APPROVED'
                      ? 'bg-green-100 text-green-700'
                      : 'bg-gray-100 text-gray-500'
                  }`}
                  title={o.platformOptionId ?? undefined}
                >
                  {optionName(o.optionId)}
                </span>
              ))}
            </div>
          )}
          {error && <p className="text-[11px] text-red-600">{error}</p>}
        </div>
      )}

      {showFieldValues && (
        <ChannelFieldValuesModal
          listingId={listing.id}
          onSaved={() => onReload()}
          onClose={() => setShowFieldValues(false)}
        />
      )}

      {showShipping && (
        <ChannelShippingOverrideModal
          listingId={listing.id}
          accountId={accountId}
          platform={platform}
          channelLabel={channelLabel}
          initialOverride={shippingOverride}
          shippingUseCase={shippingUseCase}
          listingUseCase={useCase}
          onSaved={onShippingSaved}
          onClose={() => setShowShipping(false)}
        />
      )}

      {showStock && (
        <ChannelStockModal
          listingId={listing.id}
          channelLabel={channelLabel}
          onSaved={() => onReload()}
          onClose={() => setShowStock(false)}
        />
      )}

      {showPrice && (
        <ChannelPriceModal
          listingId={listing.id}
          channelLabel={channelLabel}
          onSaved={() => onReload()}
          onClose={() => setShowPrice(false)}
        />
      )}

      {/* 되돌릴 수 있는 조작이고 파괴가 아니라 isDangerous 를 쓰지 않는다(2609_45/D13). */}
      <ConfirmDialog
        isOpen={showCategorySource}
        title="마스터 카테고리로 변경"
        message={
          <>
            이 채널의 카테고리를 마스터 카테고리로 바꿉니다.
            <br />
            <b>
              {channelCategoryLabel ?? '채널 카테고리'} → {masterCategoryName ?? '마스터 카테고리'}
            </b>
            <p>
              지금 쿠팡에 반영되지는 않습니다. 다음 [수정 요청] 때 함께 전송되며, 그때 쿠팡에서
              카테고리가 변경되고 재심사에 들어갑니다. 이 카테고리에 맞춰 넣어둔 필수 속성·고시 값은
              지워집니다.
            </p>
          </>
        }
        confirmText="변경"
        onConfirm={handleCategorySource}
        onCancel={() => setShowCategorySource(false)}
        isLoading={busy === 'category-source'}
      />

      {/* 2609_63/D10: 문구는 결과를 그대로 말한다. 지우는 게 아니므로 "삭제"·"편입 취소"로 쓰지 않는다.
          ⚠️ 「마스터 미연결만」은 실제 화면 라벨이다(ProductListingSearchCard) — 바꿔 쓰지 말 것. */}
      <ConfirmDialog
        isOpen={unlinkTarget !== null}
        title="마스터 연결 해제"
        message={
          <>
            <b>{channelLabel}</b> 채널
            {unlinkTarget?.platformProductId ? ` (상품 ID ${unlinkTarget.platformProductId})` : ''}을
            이 마스터에서 떼어냅니다.
            <ul className="mt-2 list-disc space-y-1 pl-5 text-base">
              <li>쿠팡에는 아무것도 전송하지 않습니다 — 상품은 그대로 팔립니다.</li>
              <li>주문·고객문의·정산 기록은 이 판매상품에 그대로 남습니다.</li>
              <li>해제하면 판매상품 목록의 「마스터 미연결만」에서 볼 수 있습니다.</li>
              <li>
                올바른 마스터에서 [쿠팡 상품 가져오기] 에 같은 상품 ID 를 넣으면 이 판매상품이 그대로
                다시 붙습니다.
              </li>
            </ul>
          </>
        }
        confirmText="연결 해제"
        isDangerous
        isLoading={busy === 'unlink'}
        onConfirm={() => unlinkTarget && handleUnlink(unlinkTarget)}
        onCancel={() => setUnlinkTarget(null)}
      />

      {/* 지워지는 것은 **이 채널 줄**뿐이다 — 마스터의 옵션·구성상품은 그대로다(2609_63/D13). */}
      <ConfirmDialog
        isOpen={deleteTarget !== null}
        title="채널 삭제"
        message={
          <>
            <b>{channelLabel}</b> 채널 1줄을 지웁니다. 아직 쿠팡에 보낸 적이 없는 채널입니다.
            <ul className="mt-2 list-disc space-y-1 pl-5 text-base">
              <li>이 채널의 옵션·구성·자동 생성된 썸네일·상세가 함께 지워집니다.</li>
              <li>쿠팡에는 아무것도 전송하지 않습니다.</li>
              <li>되돌릴 수 없습니다 — 다시 만들려면 [채널 추가] 를 쓰세요.</li>
            </ul>
          </>
        }
        confirmText="삭제"
        isDangerous
        isLoading={busy === 'delete-cell'}
        onConfirm={() => deleteTarget && handleDeleteCell(deleteTarget)}
        onCancel={() => setDeleteTarget(null)}
      />

      {showOptionName && (
        <ChannelOptionNameModal
          listingId={listing.id}
          channelLabel={channelLabel}
          onSaved={() => onReload()}
          onClose={() => setShowOptionName(false)}
        />
      )}
    </div>
  );
}
