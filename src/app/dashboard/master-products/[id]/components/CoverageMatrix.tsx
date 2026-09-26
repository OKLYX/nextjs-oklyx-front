'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { PageContainer } from '@/presentation/components/PageContainer';
import { Spinner } from '@/presentation/components/Spinner';
import { useAuthStore } from '@/infrastructure/stores/authStore';
import { ROUTES } from '@/config/routes';
import { listReturnHref } from '@/infrastructure/utils/listReturn';
import { MasterProductUseCase } from '@/application/usecases/MasterProductUseCase';
import { MasterProductRepositoryImpl } from '@/infrastructure/repositories/MasterProductRepositoryImpl';
import { ListingRegistrationUseCase } from '@/application/usecases/ListingRegistrationUseCase';
import { ListingRegistrationRepositoryImpl } from '@/infrastructure/repositories/ListingRegistrationRepositoryImpl';
import { ShippingUseCase } from '@/application/usecases/ShippingUseCase';
import { ShippingRepositoryImpl } from '@/infrastructure/repositories/ShippingRepositoryImpl';
import { CarrierRateUseCase } from '@/application/usecases/CarrierRateUseCase';
import { CarrierRateRepositoryImpl } from '@/infrastructure/repositories/CarrierRateRepositoryImpl';
import { PackageUseCase } from '@/application/usecases/PackageUseCase';
import { PackageRepositoryImpl } from '@/infrastructure/repositories/PackageRepositoryImpl';
import { ThumbnailTemplateUseCase } from '@/application/usecases/ThumbnailTemplateUseCase';
import { ThumbnailTemplateRepositoryImpl } from '@/infrastructure/repositories/ThumbnailTemplateRepositoryImpl';
import { CategoryUseCase } from '@/application/usecases/CategoryUseCase';
import { CategoryRepositoryImpl } from '@/infrastructure/repositories/CategoryRepositoryImpl';
import { CategoryMappingUseCase } from '@/application/usecases/CategoryMappingUseCase';
import { CategoryMappingRepositoryImpl } from '@/infrastructure/repositories/CategoryMappingRepositoryImpl';
import { DetailContentUseCase } from '@/application/usecases/DetailContentUseCase';
import { DetailContentRepositoryImpl } from '@/infrastructure/repositories/DetailContentRepositoryImpl';
import { ProductImageUseCase } from '@/application/usecases/ProductImageUseCase';
import { ProductImageRepositoryImpl } from '@/infrastructure/repositories/ProductImageRepositoryImpl';
import type {
  MatrixCell,
  MatrixRow,
  ListingMatrixResponse,
  MasterCategoryResponse,
  MasterChannelOptionCell,
  MasterOptionResponse,
  MasterProductResponse,
} from '@/domain/entities/MasterProductEntity';
import type { CarrierRate } from '@/domain/entities/CarrierRateEntity';
import type { Package } from '@/domain/entities/PackageEntity';
import type {
  GeneratedProductResponse,
  ChannelSyncPreview,
  ChannelSyncChannel,
  ListingOptionSummary,
} from '@/domain/entities/ListingRegistrationEntity';
import { resolveThumbUrl } from '@/infrastructure/utils/thumbUrl';
import { extractErrorMessage } from '@/infrastructure/utils/errorMessage';
import {
  ChannelPreviewModal,
  type ChannelPreviewData,
} from '@/presentation/components/DetailHtmlPreview';
import { MasterOptionEditor } from '../../components/MasterOptionEditor';
import {
  MasterImagePool,
  type ImageField,
  type ImageFieldFilter,
} from '../../components/MasterImagePool';
import { deriveMasterImageFields } from '../../components/masterImageFields';
import { DetailImageGroupUseCase } from '@/application/usecases/DetailImageGroupUseCase';
import { DetailImageGroupRepositoryImpl } from '@/infrastructure/repositories/DetailImageGroupRepositoryImpl';
import { submitNoticeGroup } from './categoryMetaValidation';
import { DetailSection } from './DetailSection';
import { BasicInfoTabs, type BasicTabKey } from './BasicInfoTabs';
import { ChannelOptionTable } from './ChannelOptionTable';
import { MasterCategoryPanel } from './MasterCategoryPanel';
import { CategoryMetaPanel } from './CategoryMetaPanel';
import { MasterBasicInfoPanel } from './MasterBasicInfoPanel';
import { MasterFieldValuesPanel } from './MasterFieldValuesPanel';
import { MasterDefaultCostPanel, carrierLabel, packageLabel } from './MasterDefaultCostPanel';
import { MasterTagsPanel } from './MasterTagsPanel';
import { MasterRegistrationSuffixPanel } from './MasterRegistrationSuffixPanel';
import { MasterShippingOverridePanel } from './MasterShippingOverridePanel';
import { ImportCoupangProductModal } from './ImportCoupangProductModal';
import { ListingRow, cellActionCount } from './ListingRow';
import { MARKET_OPTION_LOCK_REASON } from './ListingDetailPanel';
import { ConfirmDialog } from '@/presentation/components/ui/ConfirmDialog';

interface CoverageMatrixProps {
  id: string;
}

/**
 * 마스터 상세 = 채널 체크목록(계정 × 리스팅) + 미등록 일괄/행별 등록 + 전파 배선.
 * File: src/app/dashboard/master-products/[id]/components/CoverageMatrix.tsx
 *
 * 채널(판매자×플랫폼)은 판매채널 관리 화면에서 정의됨 → 여기선 다시 선택하지 않는다.
 * 매트릭스 행이 곧 테넌트 전 채널 목록(registered 플래그). 미등록 행을 체크해 일괄 등록하거나
 * 행별 [등록] 원클릭으로 등록한다. 옵션은 15에서 전체 복사되므로 옵션 선택 UI 없음.
 *
 * ⚠️ 머리말 오른쪽 끝에 [마스터 삭제](하드 삭제, 2609_72)가 있다. 성공하면 이 화면이 사라지므로
 * **사용자가 왔던 목록 상태로 `replace`** 한다(`listReturnHref`) — 실패는 여기 머물며 배너로 알린다.
 */
/**
 * 출고지·반품지가 없는 판매자에 채널을 만들 수 없는 이유(사용자 결정 2026-08-28). 그 판매자의 채널은
 * 전부 배송 정보가 비게 되므로 생성 자체를 막고, 판매자 배송 설정을 먼저 끝내게 안내한다.
 */
const SHIPPING_BLOCK_REASON =
  '이 판매자의 출고지·반품지가 지정되지 않아 채널을 만들 수 없습니다. 판매채널 관리 > 배송관리에서 출고지·반품지를 먼저 지정하세요.';

/**
 * 채널 반영 요약 줄(90). 배너와 확인 모달이 **같은 문구**를 쓰도록 여기서 한 번만 만든다 —
 * 두 곳에 복붙하지 말 것. 0 인 항목은 생략한다.
 *
 * ⚠️ `marketChannelOnlyOptions` 는 반영이 손대지 않으므로(89 규칙) 여기 건수에 포함하지 않는다.
 */
const syncSummaryLines = (preview: ChannelSyncPreview): string[] => {
  const t = preview.totals;
  const lines: string[] = [];
  if (t.missingOptions > 0) lines.push(`채널에 없는 옵션 ${t.missingOptions}`);
  if (t.channelOnlyOptions > 0) lines.push(`마스터에 없는 옵션 ${t.channelOnlyOptions}`);
  if (t.quantityMismatch > 0) lines.push(`수량이 다른 옵션 ${t.quantityMismatch}`);
  return lines;
};

/** 배너 건수 = 옵션 건수 합(채널 수가 아니다 — 버튼 배지가 채널 수). */
const syncOptionCount = (preview: ChannelSyncPreview): number =>
  preview.totals.missingOptions + preview.totals.channelOnlyOptions + preview.totals.quantityMismatch;

/** 한 채널 줄의 `{항목 라벨}: {옵션명, 옵션명}` 조각들(0 인 항목 생략). 회색 안내 항목은 제외. */
const channelDiffText = (c: ChannelSyncChannel): string => {
  const parts: string[] = [];
  if (c.missingOptions.length > 0) parts.push(`채널에 없는 옵션: ${c.missingOptions.join(', ')}`);
  if (c.channelOnlyOptions.length > 0) parts.push(`마스터에 없는 옵션: ${c.channelOnlyOptions.join(', ')}`);
  if (c.quantityMismatchOptions.length > 0)
    parts.push(`수량이 다른 옵션: ${c.quantityMismatchOptions.join(', ')}`);
  return parts.join(' · ');
};

/**
 * 한 계정 행이 가진 **모든** 채널 셀. 매트릭스의 모든 조회·표시는 이 목록 하나만 본다.
 *
 * 🔴 한 계정(판매자×플랫폼)이 같은 마스터로 쿠팡 상품페이지를 여러 개 가질 수 있다
 * (2026-09-19 편입 가드 완화, 실측 139건). 첫 셀(`row.cell`)만 보면 두 번째 페이지의 썸네일·
 * 상태·판매가·액션이 화면에 아예 없는 것처럼 된다.
 * ⚠️ `cells` 는 optional 이므로(프론트가 백엔드보다 먼저 배포될 수 있다) 첫 셀 호환 필드로 폴백한다.
 * ⚠️ `row.cell` 은 백엔드 계약이라 타입·응답에서 지우지 않는다 — 화면 로직만 이 함수를 지난다.
 */
const rowCellsOf = (row: MatrixRow): MatrixCell[] => row.cells ?? (row.cell ? [row.cell] : []);

/**
 * 셀 하나를 가리키는 **모달·확인창용** 꼬리표. 미전송 셀은 마켓 ID 가 없으므로 상태 문구로 대신한다.
 * ⚠️ 목록 안에서는 쓰지 않는다 — 판매상품 행의 보조줄이 상품 ID 를 이미 보여준다.
 */
const cellTag = (cell: MatrixCell): string => cell.platformProductId ?? '미전송';

/**
 * 「조치가 필요한 항목이 먼저」(2026-09-26): 조치 칩이 있는 판매상품을 앞으로. 동점은 응답 순서 유지
 * (`Array.prototype.sort` 는 안정 정렬). ⚠️ 복사본을 정렬한다 — 응답 배열을 건드리지 않는다.
 */
const sortedCells = (cells: MatrixCell[]): MatrixCell[] =>
  [...cells].sort((a, b) => cellActionCount(b) - cellActionCount(a));

const rowActionCount = (row: MatrixRow): number =>
  rowCellsOf(row).reduce((sum, c) => sum + cellActionCount(c), 0);

export function CoverageMatrix({ id }: CoverageMatrixProps) {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const isAdmin = user?.role === 'ADMIN';
  const masterId = Number(id);

  const masterUseCase = useMemo(
    () => new MasterProductUseCase(new MasterProductRepositoryImpl()),
    [],
  );
  const listingUseCase = useMemo(
    () => new ListingRegistrationUseCase(new ListingRegistrationRepositoryImpl()),
    [],
  );
  // Shipping lookup (outbound/return) for the channel override modal — parent-owned,
  // injected into CellActions (never created inside the modal).
  const shippingUseCase = useMemo(() => new ShippingUseCase(new ShippingRepositoryImpl()), []);
  // Carrier/box candidates + template fields for the inline detail panels (83A) — parent-owned and
  // injected, so a panel never re-fetches what this container already holds.
  const carrierRateUseCase = useMemo(
    () => new CarrierRateUseCase(new CarrierRateRepositoryImpl()),
    [],
  );
  const packageUseCase = useMemo(() => new PackageUseCase(new PackageRepositoryImpl()), []);
  const templateUseCase = useMemo(
    () => new ThumbnailTemplateUseCase(new ThumbnailTemplateRepositoryImpl()),
    [],
  );
  // Category tree + per-platform mappings for the 표준 카테고리 section (83B) — parent-owned, injected.
  const categoryUseCase = useMemo(() => new CategoryUseCase(new CategoryRepositoryImpl()), []);
  const mappingUseCase = useMemo(
    () => new CategoryMappingUseCase(new CategoryMappingRepositoryImpl()),
    [],
  );
  // Image pool + its field derivation (83B). The pool commits straight to the server in edit mode.
  const detailUseCase = useMemo(
    () => new DetailContentUseCase(new DetailContentRepositoryImpl()),
    [],
  );
  const groupUseCase = useMemo(
    () => new DetailImageGroupUseCase(new DetailImageGroupRepositoryImpl()),
    [],
  );
  const productImageUseCase = useMemo(
    () => new ProductImageUseCase(new ProductImageRepositoryImpl()),
    [],
  );
  const [matrix, setMatrix] = useState<ListingMatrixResponse | null>(null);
  // The full master (83A): `load()` already fetches it, so keeping it here feeds every inline panel
  // and the collapsed-section summaries from ONE getById instead of one call per panel.
  const [master, setMaster] = useState<MasterProductResponse | null>(null);
  const [carrierRates, setCarrierRates] = useState<CarrierRate[]>([]);
  const [packages, setPackages] = useState<Package[]>([]);
  const [options, setOptions] = useState<MasterOptionResponse[]>([]);
  // Standard category SSOT for the whole detail page (83B): loaded once in `load()` and replaced in
  // place by MasterCategoryPanel's onCategoryChanged. 카테고리 메타 섹션과 옵션 섹션이 같은 값을 쓴다.
  const [category, setCategory] = useState<MasterCategoryResponse | null>(null);
  // Bumped by the 카테고리 메타 섹션 after a save → re-fetches the option editor's inherit baseline.
  // ⚠️ 유일한 갱신 경로다: DetailSection 은 접었다 펴도 remount 되지 않아 스스로 낫지 않는다.
  const [metaVersion, setMetaVersion] = useState(0);
  // 옵션 override diff 의 기준값 = **서버에 저장된** 마스터 카테고리 메타(쿠팡).
  const [masterAttrValues, setMasterAttrValues] = useState<Record<string, string>>({});
  const [masterNoticeValues, setMasterNoticeValues] = useState<Record<string, string>>({});
  // 옵션 고시 노출·검증 범위 = 마스터가 저장/선택한 실효 품목군(submitNoticeGroup 단일 해석).
  const [masterNoticeGroup, setMasterNoticeGroup] = useState<string | null>(null);
  const [metaBaseError, setMetaBaseError] = useState('');
  // MasterImagePool field derivation (대표사진 + 이미지 그룹 카탈로그).
  const [imageFields, setImageFields] = useState<ImageField[]>([]);
  const [imageFieldFilters, setImageFieldFilters] = useState<ImageFieldFilter[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  // Read-only preview gallery: per-channel generated assets (thumbnail image +
  // detail-page HTML). undefined = still loading, null = fetch failed.
  const [generated, setGenerated] = useState<Record<number, GeneratedProductResponse | null>>({});
  const [genLoading, setGenLoading] = useState(false);

  // Accounts whose 출고지/반품지 are unset, keyed by accountId. Channel creation is BLOCKED for them
  // (사용자 결정 2026-08-28): every channel of such a seller would carry no shipping info at all, so the
  // seller's 배송 설정 has to come first. Missing key = unknown (fetch failed) → never blocks, so a lookup
  // outage can't dead-end the screen.
  // ⚠️ This checks 출고지·반품지 only; the authority on *market* registerability stays the backend
  // `shippingReady` (78 guard on the cell). Do not grow this into a client-side ShippingReadiness mirror.
  const [placesUnset, setPlacesUnset] = useState<Record<number, boolean>>({});
  const [preview, setPreview] = useState<ChannelPreviewData | null>(null);

  // Open the tabbed preview modal for a channel cell, on the given initial tab.
  // ⚠️ `title` 은 호출부가 만든다 — 한 계정에 셀이 여럿이면 판매자·플랫폼만으로는 어느 쿠팡
  // 페이지의 미리보기인지 구분되지 않아 그 셀의 상품 ID 를 붙여야 한다.
  const openPreview = (
    gen: GeneratedProductResponse | null,
    title: string,
    initialTab: 'image' | 'detail',
  ) => {
    setPreview({
      imageSrc: gen?.thumbnailUrl ? resolveThumbUrl(gen.thumbnailUrl) : null,
      html: gen?.detailHtml ?? null,
      title,
      initialTab,
    });
  };

  // Selection of unregistered channels, keyed by accountId.
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [isBatchAdding, setIsBatchAdding] = useState(false);
  const [rowBusyId, setRowBusyId] = useState<number | null>(null);
  const [batchSummary, setBatchSummary] = useState<
    { text: string; tone: 'green' | 'amber'; failures: string[] } | null
  >(null);

  // Propagate (A-layer) summary banner
  const [isPropagating, setIsPropagating] = useState(false);
  const [banner, setBanner] = useState<{ text: string; tone: 'green' | 'amber' } | null>(null);
  // 생성 페이지가 "마스터는 만들어졌지만 후속 저장 일부가 실패" 로 보낼 때 `?notice=` 로 사유를 넘긴다.
  // state 로 옮기지 않고 URL 에서 바로 파생한다 — 이펙트 안 setState 는 렌더를 한 번 더 돌리고,
  // 이 값은 URL 이 이미 단일 출처다. 이 화면이 스스로 만든 `banner` 가 있으면 그쪽이 이긴다(최신 동작).
  const searchParams = useSearchParams();
  const createNotice = searchParams.get('notice');
  const shownBanner = banner ?? (createNotice ? { text: createNotice, tone: 'amber' as const } : null);
  // 반영 전 미리보기(90). null = 미로드/조회 중/실패/비-ADMIN → 아무것도 주장하지 않는다
  // (배너 숨김 + 버튼은 기존대로 활성). 로딩 전용 스피너를 두지 않는 이유이기도 하다.
  const [syncPreview, setSyncPreview] = useState<ChannelSyncPreview | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  // Per-channel option activation (43): the listing id currently saving an active-set change.
  const [optionBusyId, setOptionBusyId] = useState<number | null>(null);
  // 2609_61: 옵션×채널 표 → 「상품 기본 정보 > 옵션」 이동. `basicOpenSignal` 은 섹션을 여는 신호(닫지
  // 않는다), `focusOption` 은 옵션 에디터가 반응할 대상이다. ⚠️ 초기값 undefined — 0 으로 두면 마운트
  // 때 섹션이 저절로 펼쳐진다(기본은 전부 접힘).
  const [basicOpenSignal, setBasicOpenSignal] = useState<number | undefined>(undefined);
  const [focusOption, setFocusOption] = useState<{ optionId: number; nonce: number } | undefined>(
    undefined,
  );
  // 2609_73: 「채널별 옵션」 → 옵션 **탭**으로. `basicOpenSignal` 이 섹션을 열고, 이것이 탭을 고른다.
  // 탭이 생긴 뒤로는 섹션만 열어서는 아무 일도 안 보이기 때문이다(옵션 탭이 아니면 가려져 있다).
  // ⚠️ 초기값 undefined — 객체를 처음부터 넘기면 마운트 때 옵션 탭이 켜진다(basicOpenSignal 과 같은 함정).
  const [basicOpenTab, setBasicOpenTab] = useState<{ key: BasicTabKey; nonce: number } | undefined>(
    undefined,
  );
  // 2609_61: 마스터의 **모든** 셀 + 그 셀의 옵션. 한 번에 받아 두 곳이 나눠 쓴다 —
  // 판매상품 행 펼침의 옵션 표(`ListingDetailPanel`)과 「채널별 옵션」 표(`ChannelOptionTable`).
  // 🔴 셀마다 옵션을 조회하지 말 것(D6). null = 미로드/조회 중, `channelOptionError` = 실패.
  const [channelOptionCells, setChannelOptionCells] = useState<MasterChannelOptionCell[] | null>(
    null,
  );
  const [channelOptionError, setChannelOptionError] = useState('');

  // 2609_22: 쿠팡 상품 가져오기 대상 행(모달 mount). null = 닫힘.
  const [importTarget, setImportTarget] = useState<{
    sellerId: number;
    platform: string;
    sellerName: string;
  } | null>(null);
  // 2609_22/D4: [옵션명 일괄 적용] 확인 모달 + 재진입 가드.
  const [applyNamesOpen, setApplyNamesOpen] = useState(false);
  const [isApplyingNames, setIsApplyingNames] = useState(false);

  // 2609_72: 마스터 삭제 확인창. 목록의 [삭제]와 같은 흐름이지만, 여기서는 보고 있던 대상이
  // 사라지므로 성공하면 이 화면을 떠난다(아래 `handleDelete`).
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Fetch per-channel generated assets (thumbnail + detail HTML) in one call each,
  // N calls total, without blocking the table render. Each failure is absorbed as
  // null so one bad channel never stalls the rest.
  // 🔴 계정이 아니라 **셀** 단위로 돈다 — 종전엔 첫 셀 id 만 모아서, 두 번째 셀은 썸네일·상세·
  // 판매가(옵션가)·태그·배송설정·shippingReady 가 애초에 조회되지 않았다(렌더를 고쳐도 빈칸).
  // `generated` 는 listingId 키라 per-cell 로 그대로 동작한다.
  const fetchGenerated = useCallback(
    async (m: ListingMatrixResponse) => {
      const registered = m.rows.flatMap((r) => rowCellsOf(r)).map((c) => c.productListingId);
      setGenLoading(true);
      const entries = await Promise.all(
        registered.map(async (lid) => {
          try {
            return [lid, await listingUseCase.getGenerated(lid)] as const;
          } catch {
            return [lid, null] as const;
          }
        }),
      );
      setGenerated(Object.fromEntries(entries));
      setGenLoading(false);
    },
    [listingUseCase],
  );

  // Per-account 출고지/반품지 presence for rows with no cell yet (a not-yet-created channel has no
  // override, so places resolve to the account default alone). Registered rows already carry the
  // backend's shippingReady, so they are skipped. Fire-and-forget; each failure is simply unknown.
  const fetchPlaces = useCallback(
    async (m: ListingMatrixResponse) => {
      const accountIds = m.rows
        .filter((r) => !r.registered || rowCellsOf(r).length === 0)
        .map((r) => r.accountId);
      const entries = await Promise.all(
        accountIds.map(async (accountId) => {
          try {
            const cfg = await shippingUseCase.getConfig(accountId);
            const unset =
              !cfg.outboundShippingPlaceCode?.trim() || !cfg.returnCenterCode?.trim();
            return [accountId, unset] as const;
          } catch {
            return null;
          }
        }),
      );
      setPlacesUnset(Object.fromEntries(entries.filter((e) => e !== null)));
    },
    [shippingUseCase],
  );

  // 반영할 항목 미리보기(90). fire-and-forget — 매트릭스 렌더를 막지 않는다.
  // 🔴 89 는 /api/admin/** 이고 이 페이지는 비-ADMIN 도 열 수 있으므로 ADMIN 에서만 조회한다
  // (게이트가 없으면 로드마다 403 이 난다).
  const fetchSyncPreview = useCallback(async () => {
    if (!isAdmin) {
      setSyncPreview(null);
      return;
    }
    setSyncPreview(await listingUseCase.getChannelSyncPreview(masterId));
  }, [listingUseCase, masterId, isAdmin]);

  // 2609_61: 채널 옵션 집계(D6 — 셀 수와 무관하게 호출 1번).
  // 🔴 `/api/admin/**` 이라 ADMIN 에서만 부른다(`fetchSyncPreview` 와 같은 이유).
  // fire-and-forget — 매트릭스 렌더를 막지 않는다. 실패해도 표 본체는 그대로 그려진다.
  const fetchChannelOptions = useCallback(async () => {
    if (!isAdmin) {
      setChannelOptionCells(null);
      setChannelOptionError('');
      return;
    }
    setChannelOptionError('');
    try {
      const res = await masterUseCase.getChannelOptions(masterId);
      setChannelOptionCells(res.cells ?? []);
    } catch (e: unknown) {
      setChannelOptionCells(null);
      setChannelOptionError(extractErrorMessage(e, '채널별 옵션을 불러오지 못했습니다.'));
    }
  }, [masterUseCase, masterId, isAdmin]);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError('');
    try {
      const [m, master, cat] = await Promise.all([
        masterUseCase.getMatrix(masterId),
        masterUseCase.getById(masterId),
        masterUseCase.getCategory(masterId).catch(() => null),
      ]);
      setMatrix(m);
      setMaster(master);
      setOptions(master.options);
      setCategory(cat);
      setSelected(new Set());
      void fetchGenerated(m); // fire-and-forget; table draws immediately, previews fill in after
      void fetchPlaces(m); // ditto — the 배송 설정 warning on unregistered rows fills in after
      void fetchSyncPreview().catch(() => setSyncPreview(null)); // ditto — banner fills in after
      // 2609_61: 옵션·가격·재고가 바뀌는 경로는 전부 이 재조회를 지나므로 채널 옵션 갱신도 여기 한 곳에서.
      void fetchChannelOptions(); // ditto — 채널 행의 옵션 목록과 표가 뒤이어 채워진다
    } catch {
      setError('커버리지 매트릭스를 불러오지 못했습니다.');
    } finally {
      setIsLoading(false);
    }
  }, [
    masterUseCase,
    masterId,
    fetchGenerated,
    fetchPlaces,
    fetchSyncPreview,
    fetchChannelOptions,
  ]);

  useEffect(() => {
    void (async () => {
      await load();
    })();
  }, [load]);

  // Carrier/box candidates for the 기본 택배/상자 panel (and, later, the option editor). Loaded once
  // here so the panels never re-fetch; a failure only disables that panel's editing, never the matrix.
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [rates, boxes] = await Promise.all([
          carrierRateUseCase.getCarrierRates(),
          // 🔴 판매가 계산용 상자 후보 = 구매 상자만(PLAN 2609_40 D21).
          packageUseCase.getPackages('PURCHASED'),
        ]);
        if (!alive) return;
        setCarrierRates(rates);
        setPackages(boxes);
      } catch {
        // Secondary data — the matrix must still render.
      }
    })();
    return () => {
      alive = false;
    };
  }, [carrierRateUseCase, packageUseCase]);

  // A detail panel saved its own fields (83A): merge the response into the master we hold and, for the
  // name, patch the page header in place. ⚠️ Never reload the matrix here — a one-line name save would
  // otherwise re-run getMatrix + N getGenerated + fetchPlaces and re-flash every thumbnail.
  const handlePanelSaved = useCallback((patched: MasterProductResponse) => {
    setMaster((prev) => (prev ? { ...prev, ...patched } : patched));
    setMatrix((prev) => (prev ? { ...prev, masterName: patched.name } : prev));
  }, []);

  /**
   * 2609_61: 옵션×채널 표의 [옵션 수정] — 「상품 기본 정보」를 펼치고 그 옵션의 수정 폼으로 보낸다.
   * 🔴 `router.push` 를 쓰지 말 것 — 페이지가 다시 렌더되며 매트릭스 상태(선택·배너·썸네일)가 날아간다.
   * 해시는 새로고침·뒤로가기에도 "어디로 갔었는지" 가 남도록 `replaceState` 로만 바꾼다.
   */
  const handleEditMasterOption = useCallback((masterOptionId: number) => {
    // 🔴 `basicOpenSignal` 은 **증가 카운터**다(타임스탬프로 바꾸지 말 것).
    setBasicOpenSignal((n) => (n ?? 0) + 1);
    // nonce = 같은 옵션을 다시 눌러도 에디터가 또 반응하게 하는 값.
    // 2609_73: 하이라이트(focusOption)와 탭 전환(basicOpenTab)이 한 번의 클릭으로 묶이도록 같은 값을 쓴다.
    const nonce = Date.now();
    setFocusOption({ optionId: masterOptionId, nonce });
    setBasicOpenTab({ key: 'options', nonce });
    window.history.replaceState(null, '', `#master-option-${masterOptionId}`);
  }, []);

  // 혼합구성 판정 = 구성품 종수 >= 2 (백엔드 63 미러, 생성 모달 106행과 같은 규칙). 카테고리 메타 패널과
  // 옵션 에디터의 hideCategoryAttrs 가 함께 쓴다.
  const isBundle = (master?.components.length ?? 0) >= 2;
  // 표시/필수 = 선택 플랫폼 요구 union. 오늘 쿠팡 단일이라 항상 true.
  // TODO: 플랫폼 선택 모델 도입 시 실제 선택값으로 교체 (out of scope) — 네이버 추가 시 union 확장.
  const coupangSelected = true;
  const hideCategoryAttrs = coupangSelected && isBundle;
  const categoryId = category?.categoryId ?? null;

  // 옵션 택배/상자 select 의 "마스터 기본값" 기준. ⚠️ 비우면 normalizeOptionPayload 의 "마스터 기본값과
  // 같으면 omit(상속)" 규칙이 깨져 옵션마다 택배/상자가 명시 저장되고 마스터 기본값 변경이 반영되지 않는다.
  const optionMasterDefaults = useMemo(
    () => ({
      deliveryId: master?.defaultDeliveryId ?? undefined,
      packageId: master?.defaultPackageId ?? undefined,
    }),
    [master?.defaultDeliveryId, master?.defaultPackageId],
  );

  // 이미지 풀의 "제품 이미지" 탭 소스 = 이 마스터의 구성상품(BOM).
  const sourceProducts = useMemo(
    () => (master?.components ?? []).map((c) => ({ id: c.productId, name: c.productName })),
    [master],
  );

  // 옵션 override diff 의 기준값(서버에 저장된 마스터 카테고리 메타). 카테고리 변경·메타 저장(metaVersion)
  // 시에만 다시 읽는다. ⚠️ CategoryMetaPanel 도 자체 useCase 로 같은 값을 읽지만(패널 내부 미수정) 둘 다
  // 읽기 전용이라 충돌하지 않는다.
  useEffect(() => {
    let alive = true;
    // Inline async IIFE defers setState past the sync effect body (set-state-in-effect lint).
    void (async () => {
      if (categoryId == null) {
        if (!alive) return;
        setMasterAttrValues({});
        setMasterNoticeValues({});
        setMasterNoticeGroup(null);
        setMetaBaseError('');
        return;
      }
      try {
        const meta = await masterUseCase.getCategoryMeta(masterId, 'COUPANG');
        if (!alive) return;
        setMasterAttrValues(meta.values.attributes ?? {});
        setMasterNoticeValues(meta.values.notices ?? {});
        setMasterNoticeGroup(
          submitNoticeGroup(meta.notices, meta.values.notices ?? {}, meta.values.noticeGroup ?? null),
        );
        setMetaBaseError('');
      } catch {
        if (!alive) return;
        setMasterAttrValues({});
        setMasterNoticeValues({});
        setMasterNoticeGroup(null);
        setMetaBaseError(
          '카테고리 메타를 불러오지 못해 옵션의 상속 기준값이 비어 있습니다. 옵션에 입력한 값이 그대로 저장됩니다.',
        );
      }
    })();
    return () => {
      alive = false;
    };
  }, [masterUseCase, masterId, categoryId, metaVersion]);

  // 이미지 필드(대표사진 + 이미지 그룹 카탈로그). 생성 모달과 같은 도출 헬퍼를 쓴다.
  useEffect(() => {
    let alive = true;
    void (async () => {
      const { fields, fieldFilters } = await deriveMasterImageFields(detailUseCase, groupUseCase);
      if (!alive) return;
      setImageFields(fields);
      setImageFieldFilters(fieldFilters);
    })();
    return () => {
      alive = false;
    };
  }, [detailUseCase, groupUseCase]);

  const unregisteredRows = useMemo(
    () => matrix?.rows.filter((r) => !r.registered) ?? [],
    [matrix],
  );

  // Registered cells = the force-apply selection list (79). Same label as the channel modal header.
  // `override` (81) lets the panel tell which channels hold their own settings and so would not
  // receive a master save. ⚠️ `generated` must stay in the deps — it fills in after the table renders,
  // and without it every channel would stay `undefined` (= unknown) and the hint could never appear.
  // 🔴 계정당 첫 셀이 아니라 **모든 셀**이다 — 빠진 셀은 [전 채널 강제 적용] 목록에 없어서
  // 배송 설정이 조용히 반영되지 않는다. 셀이 여럿인 계정은 라벨에 그 셀의 상품 ID 를 붙인다.
  const forceApplyChannels = useMemo(
    () =>
      (matrix?.rows ?? []).flatMap((r) => {
        const cells = rowCellsOf(r);
        return cells.map((c) => ({
          listingId: c.productListingId,
          label: `${r.sellerName} · ${r.platform}${cells.length > 1 ? ` · ${cellTag(c)}` : ''}`,
          // undefined = not loaded yet / fetch failed → excluded from the hint (never over-report).
          override: generated[c.productListingId]?.shippingOverride,
        }));
      }),
    [matrix, generated],
  );
  // Collapsed-section summaries (83A): one line of current value per section, drawn from the master
  // this container already holds — no extra fetch, and they update as soon as a panel saves.
  const filledFieldCount = Object.values(master?.fieldValues ?? {}).filter((v) => v.trim() !== '')
    .length;
  const categorySummary = category ? category.categoryName : '미지정';
  const metaFilledCount =
    Object.values(masterAttrValues).filter((v) => v.trim() !== '').length +
    Object.values(masterNoticeValues).filter((v) => v.trim() !== '').length;
  // 그룹 요약 = 이름 + 카테고리 + 필수속성 수 + 옵션 수 + 대표사진 유무(접힌 채로 그룹 안 다섯
  // 블록 상태를 읽게). ⚠️ 위 세 파생값은 여기서 즉시 읽히므로 반드시 basicSummary **앞**에 둔다.
  const basicSummary = master
    ? `${master.name} · ${categorySummary} · 필수속성 ${
        metaFilledCount
      }개 · 옵션 ${options.length}개 · ${
        master.sourceImageUrl ? '대표사진 있음' : '대표사진 없음'
      }`
    : undefined;
  // 2609_61: 리스팅 id → 그 셀의 옵션. 채널 행 아래 인라인 목록이 이걸로 자기 옵션만 집는다.
  const channelOptionsByListingId = useMemo(() => {
    const map = new Map<number, ListingOptionSummary[]>();
    for (const cell of channelOptionCells ?? []) map.set(cell.productListingId, cell.options);
    return map;
  }, [channelOptionCells]);

  // 2609_61 표 요약 = 옵션 수 · 채널 셀 수. ⚠️ 계정 수가 아니라 셀 수다(한 계정에 셀이 여럿일 수 있다).
  const channelCellCount = (matrix?.rows ?? []).reduce(
    (sum, row) => sum + rowCellsOf(row).length,
    0,
  );
  const channelOptionSummary = `옵션 ${options.length}개 · 채널 ${channelCellCount}개`;
  const fieldValuesSummary = filledFieldCount > 0 ? `${filledFieldCount}개 입력됨` : '입력 없음';
  const summaryCarrier = carrierRates.find((r) => r.id === master?.defaultDeliveryId);
  const summaryPackage = packages.find((p) => p.id === master?.defaultPackageId);
  const defaultCostSummary = `${summaryCarrier ? carrierLabel(summaryCarrier) : '미지정'} · ${
    summaryPackage ? packageLabel(summaryPackage) : '미지정'
  }`;
  const tagsSummary = `태그 ${(master?.tags ?? []).length}개`;
  const suffixSummary = master?.optionCheckSuffix?.trim()
    ? master.optionCheckSuffix
    : '기본값 사용';
  const shippingOverrideCount = Object.keys(master?.shippingOverride ?? {}).length;
  const shippingSummary =
    shippingOverrideCount > 0 ? `${shippingOverrideCount}개 항목 지정` : '기본값 사용';
  // 출고지·반품지 없는 판매자 = 채널 생성 차단. Strict true → unknown(조회 실패)은 막지 않는다.
  const isShippingBlocked = (accountId: number) => placesUnset[accountId] === true;
  const selectableRows = unregisteredRows.filter((r) => !isShippingBlocked(r.accountId));
  // Selection may hold rows that became blocked once placesUnset arrived → derive the effective set
  // instead of pruning state in an effect (set-state-in-effect is banned in this project).
  const effectiveSelected = [...selected].filter((id) => !isShippingBlocked(id));
  const allSelected = selectableRows.length > 0 && effectiveSelected.length === selectableRows.length;

  const toggleOne = (accountId: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(accountId)) next.delete(accountId);
      else next.add(accountId);
      return next;
    });
  };

  const toggleAll = () => {
    setSelected(allSelected ? new Set() : new Set(selectableRows.map((r) => r.accountId)));
  };

  const handleBatchAdd = async () => {
    // Blocked rows are excluded here too: the flag can land after a row was already checked.
    const targets = unregisteredRows
      .filter((r) => selected.has(r.accountId) && !isShippingBlocked(r.accountId))
      .map((r) => ({ sellerId: r.sellerId, platform: r.platform }));
    if (targets.length === 0) {
      setError('등록할 채널이 없습니다. 출고지·반품지가 지정되지 않은 판매자는 채널을 만들 수 없습니다.');
      return;
    }
    setIsBatchAdding(true);
    setBatchSummary(null);
    setError('');
    try {
      const res = await listingUseCase.addChannelsBatch(masterId, { targets });
      const failures = res.results
        .filter((r) => !r.success)
        .map((r) => {
          const name = matrix?.rows.find(
            (row) => row.sellerId === r.sellerId && row.platform === r.platform,
          )?.sellerName;
          return `${name ?? r.sellerId}/${r.platform} — ${r.errorMessage ?? '실패'}`;
        });
      setBatchSummary({
        text: `요청 ${res.requested} · 등록 ${res.succeeded} · 실패 ${res.failed}`,
        tone: res.failed > 0 ? 'amber' : 'green',
        failures,
      });
      await load();
    } catch {
      setError('일괄 등록에 실패했습니다.');
    } finally {
      setIsBatchAdding(false);
    }
  };

  const handleRowAdd = async (accountId: number, sellerId: number, platform: string) => {
    setRowBusyId(accountId);
    setError('');
    try {
      await listingUseCase.addChannel(masterId, { sellerId, platform });
      await load();
    } catch (e: unknown) {
      const err = e as { response?: { status?: number; data?: { message?: string } } };
      if (err?.response?.status === 400) {
        setError(
          '표준 카테고리가 마스터에 설정되지 않았거나 이 플랫폼 매핑이 없습니다. 위 ‘표준 카테고리’에서 먼저 지정하세요.'
            + (err.response.data?.message ? ` (${err.response.data.message})` : ''),
        );
      } else {
        setError('채널 등록에 실패했습니다.');
      }
    } finally {
      setRowBusyId(null);
    }
  };

  // [채널에 반영하기] = 확인 모달만 연다. ConfirmDialog 은 선언형이라 window.confirm 처럼
  // 한 줄로 치환할 수 없어 핸들러를 열기/실행 둘로 쪼갠다.
  const handlePropagateClick = () => setConfirmOpen(true);

  const handlePropagateConfirm = async () => {
    // ⚠️ ConfirmDialog 에 isLoading 을 넘기지 않는다 → 재진입 가드는 호출부 책임
    // (ChannelShippingOverrideModal 선례).
    if (isPropagating) return;
    setConfirmOpen(false);
    setIsPropagating(true);
    setBanner(null);
    try {
      const res = await listingUseCase.propagate(masterId);
      const extra =
        (res.skipped > 0 ? ` · 반영 대상이 아닌 채널 ${res.skipped}개` : '') +
        (res.failed > 0 ? ` · 실패 ${res.failed}개` : '');
      setBanner({
        text: `${res.propagated}개 채널에 반영했습니다.${extra} — 마켓 반영은 반영/승인 콘솔에서 진행하세요.`,
        tone: res.failed > 0 ? 'amber' : 'green',
      });
      await load(); // 미리보기도 여기서 새로 받는다 — 추가 호출 금지
    } catch {
      setBanner({ text: '채널 반영에 실패했습니다.', tone: 'amber' });
    } finally {
      setIsPropagating(false);
    }
  };

  // 2609_63: 연결 해제·미전송 삭제 성공 → 상단 배너 + 재조회. 성공 문구를 셀 안에서 띄우면
  // 재조회로 그 액션 영역이 사라져 문구도 같이 사라진다 → 알림은 부모(매트릭스)가 소유한다.
  const handleCellRemoved = async (message: string) => {
    setBanner({ text: message, tone: 'green' });
    await load();
  };

  // 2609_22: 가져오기 성공 → 매트릭스 재조회 + 커밋에서 처음 온 카테고리 경고를 그대로 노출.
  const handleImportDone = async (categoryWarning: string | null) => {
    setBanner(categoryWarning ? { text: categoryWarning, tone: 'amber' } : null);
    await load();
  };

  // [옵션명 일괄 적용](2609_22/D4): 채널이 따로 지정한 옵션명을 마스터 기준으로 되돌린다.
  const handleApplyNamesConfirm = async () => {
    // ⚠️ ConfirmDialog 에 isLoading 을 넘기지 않는다 → 재진입 가드는 호출부 책임.
    if (isApplyingNames) return;
    setApplyNamesOpen(false);
    setIsApplyingNames(true);
    setBanner(null);
    try {
      const res = await listingUseCase.applyMasterOptionNames(masterId);
      // ⚠️ `warnings` 는 이미 완성된 안내 문장이다(셀 id 배열 아님) — 그대로 이어 붙인다.
      // 구버전 응답(필드 없음)에서도 렌더 에러가 나지 않게 `?? []`.
      const warnings = res.warnings ?? [];
      setBanner({
        text:
          `${res.updatedCells}개 채널 · ${res.updatedOptions}개 옵션의 이름을 마스터 기준으로 되돌렸습니다.` +
          (warnings.length > 0 ? ` — ${warnings.join(' · ')}` : ''),
        tone: warnings.length > 0 ? 'amber' : 'green',
      });
      await load();
    } catch (e: unknown) {
      setBanner({ text: extractErrorMessage(e, '옵션명 일괄 적용에 실패했습니다.'), tone: 'amber' });
    } finally {
      setIsApplyingNames(false);
    }
  };

  /**
   * 마스터 삭제(2609_72 하드 삭제). 호출·확인 문구는 목록의 [삭제]와 같지만 **끝이 다르다** —
   * 보고 있던 대상이 사라지므로 이 화면에 남아 있을 수 없다.
   *
   * 🔴 성공하면 사용자가 왔던 **목록 상태(페이지·검색어)로** 돌아간다(`listReturnHref`).
   *    그냥 1페이지로 튕기면 지우려던 다음 항목을 다시 찾아 들어가야 한다.
   * 🔴 `replace` 를 쓴다 — 삭제된 상세가 뒤로가기 스택에 남으면 빈 화면으로 되돌아간다.
   * ⚠️ 실패(마켓에 올린 채널이 남음 등)는 **이 화면에 머물며** 서버 문구를 그대로 배너에 띄운다.
   *    창 위에 창을 겹치지 않도록 확인창은 닫는다.
   */
  const handleDelete = async () => {
    // ⚠️ ConfirmDialog 은 선언형이라 재진입 가드는 호출부 책임.
    if (isDeleting) return;
    setIsDeleting(true);
    setError('');
    try {
      await masterUseCase.remove(masterId);
      setDeleteOpen(false);
      // 이동 중에도 버튼이 눌리지 않게 `isDeleting` 은 되돌리지 않는다(성공 경로엔 finally 없음).
      router.replace(listReturnHref(ROUTES.MASTER_PRODUCTS, searchParams));
    } catch (e: unknown) {
      setIsDeleting(false);
      setDeleteOpen(false);
      setError(extractErrorMessage(e, '삭제에 실패했습니다.'));
    }
  };

  // Toggle one option's per-channel active flag inline (43). Sends the full active set (backend
  // requires ≥1 active). On success we patch just this cell's optionPrices in place — no full
  // reload — so the row doesn't flash. needsResync (already-pushed cell) shows the re-register hint.
  const handleToggleOption = async (listingId: number, optionId: number) => {
    const prices = generated[listingId]?.optionPrices ?? [];
    const currentActive = prices.filter((p) => p.active !== false).map((p) => p.optionId);
    const isActive = currentActive.includes(optionId);
    if (isActive && currentActive.length === 1) {
      setError('최소 1개 옵션은 활성 상태여야 합니다.');
      return;
    }
    const nextActive = isActive
      ? currentActive.filter((id) => id !== optionId)
      : [...currentActive, optionId];
    setOptionBusyId(listingId);
    setError('');
    try {
      const res = await listingUseCase.setActiveOptions(listingId, { activeOptionIds: nextActive });
      const activeById = new Map(res.options.map((o) => [o.optionId, o.active]));
      setGenerated((prev) => {
        const gen = prev[listingId];
        if (!gen) return prev;
        return {
          ...prev,
          [listingId]: {
            ...gen,
            optionPrices: gen.optionPrices.map((p) => ({
              ...p,
              active: activeById.get(p.optionId) ?? p.active,
            })),
          },
        };
      });
      // Registration name is auto-recomputed from the active option set (67/68). Patch just
      // this cell's registrationName from the response — no full reload (avoids thumbnail re-flash).
      // ⚠️ `cell`(첫 셀 호환 필드)과 `cells`(전 셀)를 **함께** 갱신한다 — 화면은 `cells` 를 그리고
      // 백엔드 계약인 `cell` 은 그대로 두므로, 하나만 고치면 둘이 어긋난다.
      if (res.registrationName != null) {
        const patchCell = (c: MatrixCell): MatrixCell =>
          c.productListingId === listingId
            ? { ...c, registrationName: res.registrationName! }
            : c;
        setMatrix((prev) =>
          prev && {
            ...prev,
            rows: prev.rows.map((r) =>
              rowCellsOf(r).some((c) => c.productListingId === listingId)
                ? {
                    ...r,
                    cell: r.cell ? patchCell(r.cell) : r.cell,
                    cells: r.cells ? r.cells.map(patchCell) : r.cells,
                  }
                : r,
            ),
          },
        );
      }
      if (res.needsResync) {
        setBanner({
          text: '활성 옵션이 변경되었습니다. 마켓에 반영하려면 해당 채널의 [재생성]/[마켓 등록]으로 재등록하세요.',
          tone: 'amber',
        });
      }
      // 활성 토글은 고아 판정을 바꾸므로 미리보기만 새로 받는다. ⚠️ load() 를 부르면 안 된다
      // (썸네일 재조회로 셀이 깜빡인다 — 43 이 일부러 피한 것).
      void fetchSyncPreview().catch(() => setSyncPreview(null));
    } catch (e) {
      setError(extractErrorMessage(e, '옵션 활성 상태 변경에 실패했습니다.'));
    } finally {
      setOptionBusyId(null);
    }
  };

  // Channel shipping override saved (75): patch just this cell's generated data in
  // place (holds the new shippingOverride) — no full reload, so thumbnails don't reflash.
  const handleShippingSaved = (listingId: number, updated: GeneratedProductResponse) => {
    setGenerated((prev) => ({ ...prev, [listingId]: updated }));
  };

  const busy = isBatchAdding || rowBusyId !== null;

  // 조치가 필요한 계정이 먼저(있다/없다 두 무리, 무리 안은 응답 순서).
  const sortedRows = [...(matrix?.rows ?? [])].sort(
    (a, b) => Number(rowActionCount(b) > 0) - Number(rowActionCount(a) > 0),
  );

  /* 2609_73: 순서 = 보기(채널 매트릭스 표 · 채널별 옵션) → 편집(상품 기본 정보 + 섹션 5개).
     이 페이지의 본체가 매트릭스 표이므로, 편집 섹션 6개를 지나야 표가 나오던 순서를 뒤집었다
     (사용자 결정 2026-09-25). 머리말은 지금처럼 맨 위 그대로이고 고정도 거기 걸린다.
     ⚠️ 블록 순서만 바꾼 것이고 조건·props·조회 시점은 무변경이다. 특히 훅·파생값 선언 구역은
     손대지 않았다 — `categorySummary`/`metaFilledCount` 는 `basicSummary` 앞에 있어야 한다. */
  return (
    <PageContainer>
      {/* 2609_73: 머리말 한 줄(← 목록 · 마스터 이름 · 주요 버튼)을 화면 맨 위에 고정한다 — 아래로
          길게 스크롤해도 어떤 마스터를 보고 있는지와 버튼이 손에 닿는다(사용자 지시 2026-09-25).
          🔴 `bg-page` 가 없으면 지나가는 내용이 글자 뒤로 비친다(`PageContainer` 와 같은 배경 토큰).
          🔴 `z-20` = 표의 고정 머리(z-10)보다 위, 알림 말풍선(z-40)·`ui/Modal`(z-50) 아래.
          z-50·z-[60]·fixed inset-0 은 `npm run lint:ui`(HAND_ROLLED_POPUP)가 error 로 막는다.
          🔴 좌우 음수 마진 = 컨테이너 안쪽 여백만큼 번져 나가야 옆으로 새는 내용이 안 보인다.
          ⚠️ 섹션 제목(`DetailSection`)·탭 바는 고정하지 않는다 — 겹겹이 쌓이면 볼 내용이 줄어든다.
          ⚠️ 이 고정은 `dashboard/layout.tsx` 의 `<main>` 이 `overflow-x-clip` 이어야 동작한다
          (`auto` 면 세로축까지 스크롤 영역으로 계산돼 sticky 가 죽는다). */}
      <div className="sticky top-0 z-20 -mx-4 flex flex-wrap items-center justify-between gap-2 bg-page px-4 py-2 md:-mx-6 md:px-6">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => router.push(listReturnHref(ROUTES.MASTER_PRODUCTS, searchParams))}
            className="rounded border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-100"
          >
            ← 목록
          </button>
          <h1 className="text-xl font-semibold text-gray-900">
            {matrix ? matrix.masterName : '커버리지 매트릭스'}
          </h1>
        </div>
        {isAdmin && (
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleBatchAdd}
              disabled={effectiveSelected.length === 0 || busy}
              className="flex items-center gap-1 rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {isBatchAdding ? (
                <Spinner label="등록 중..." />
              ) : (
                `선택 채널 일괄 등록${effectiveSelected.length > 0 ? ` (${effectiveSelected.length})` : ''}`
              )}
            </button>
            <button
              type="button"
              onClick={handlePropagateClick}
              // ⚠️ `=== true` 엄격 비교: 미리보기가 null(미로드/실패)이면 막지 않는다.
              disabled={isPropagating || syncPreview?.inSync === true}
              title={syncPreview?.inSync === true ? '반영할 변경이 없습니다' : undefined}
              className="flex items-center gap-1 rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-100 disabled:opacity-50"
            >
              {isPropagating ? (
                <Spinner label="반영 중..." />
              ) : (
                `채널에 반영하기${
                  syncPreview && !syncPreview.inSync
                    ? ` (${syncPreview.totals.affectedChannels})`
                    : ''
                }`
              )}
            </button>
            {syncPreview?.inSync && (
              <span className="self-center text-sm text-gray-500">모든 채널이 최신입니다</span>
            )}
            {/* 마스터 삭제(2609_72) — 물품 상세와 같은 자리다: 상세 머리말 오른쪽 끝, 파괴적 액션이
                맨 마지막. 🔴 이 화면의 삭제 버튼은 이 하나뿐이다(섹션마다 두 번째 삭제를 만들지 말 것).
                ⚠️ `master` 가 실리기 전에는 누르지 못한다 — 확인창이 옵션·구성상품 **건수**를 말해야
                무엇이 함께 사라지는지 알 수 있다. */}
            <button
              type="button"
              onClick={() => setDeleteOpen(true)}
              disabled={master === null || isDeleting || busy}
              title={master === null ? '마스터를 불러오는 중입니다' : undefined}
              className="rounded-lg border border-red-300 px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
            >
              {isDeleting ? <Spinner label="삭제 중..." /> : '마스터 삭제'}
            </button>
          </div>
        )}
      </div>

      {batchSummary && (
        <div
          className={`rounded px-3 py-2 text-sm ${
            batchSummary.tone === 'green' ? 'bg-green-50 text-green-700' : 'bg-amber-50 text-amber-700'
          }`}
        >
          <p>{batchSummary.text}</p>
          {batchSummary.failures.length > 0 && (
            <ul className="mt-1 list-disc pl-5 text-xs">
              {batchSummary.failures.map((f, i) => (
                <li key={i}>{f}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      {shownBanner && (
        <p
          className={`rounded px-3 py-2 text-sm ${
            shownBanner.tone === 'green' ? 'bg-green-50 text-green-700' : 'bg-amber-50 text-amber-700'
          }`}
        >
          {shownBanner.text}
        </p>
      )}

      {/* 반영 전 요약(90): 무엇이 반영되는지 누르기 전에 보여준다. ⚠️ marketChannelOnlyOptions 만 있는
          채널도 목록에 오지만 건수 문장에는 넣지 않는다(반영이 손대지 않는 항목). */}
      {syncPreview && !syncPreview.inSync && (
        <div className="rounded bg-blue-50 px-3 py-2 text-sm text-blue-800">
          <p>
            채널에 반영할 변경이 {syncOptionCount(syncPreview)}건 있습니다
            {syncSummaryLines(syncPreview).length > 0 &&
              ` — ${syncSummaryLines(syncPreview).join(' · ')}`}
          </p>
          <ul className="mt-1 list-disc pl-5 text-xs">
            {/* 순서는 89 응답 그대로(sellerName→platform) — 프론트에서 재정렬 금지. */}
            {syncPreview.channels.slice(0, 5).map((c) => (
              <li key={c.listingId}>
                {channelDiffText(c) && (
                  <span>
                    {c.sellerName} · {c.platform} — {channelDiffText(c)}
                    {c.onMarket && <span className="text-gray-500"> (반영 후 재등록 필요)</span>}
                  </span>
                )}
                {c.marketChannelOnlyOptions.length > 0 && (
                  <span className="text-gray-500">
                    {channelDiffText(c) ? ' ' : `${c.sellerName} · ${c.platform} — `}
                    마스터에 없는데 판매 중: {c.marketChannelOnlyOptions.join(', ')} (WING에서 직접 중지)
                  </span>
                )}
              </li>
            ))}
          </ul>
          {syncPreview.channels.length > 5 && (
            <p className="mt-1 text-xs">외 {syncPreview.channels.length - 5}개 채널</p>
          )}
        </div>
      )}

      {/* inSync 인데 마켓 고아만 남은 경우: 배너 없이 이 안내만(버튼은 비활성 유지). */}
      {syncPreview?.inSync &&
        syncPreview.channels.some((c) => c.marketChannelOnlyOptions.length > 0) && (
          <ul className="list-disc rounded px-3 py-2 pl-8 text-xs text-gray-500">
            {syncPreview.channels
              .filter((c) => c.marketChannelOnlyOptions.length > 0)
              .slice(0, 5)
              .map((c) => (
                <li key={c.listingId}>
                  {c.sellerName} · {c.platform} — 마스터에 없는데 판매 중:{' '}
                  {c.marketChannelOnlyOptions.join(', ')} (WING에서 직접 중지)
                </li>
              ))}
          </ul>
        )}

      {error && <p className="rounded bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      {/* 반영 확인(90): 기존 공통 모달 재사용 — 신규 확인 모달을 만들지 말 것(82 선례). */}
      <ConfirmDialog
        isOpen={confirmOpen}
        title="채널에 반영"
        message={
          <div>
            <p>마스터 변경분을 연결된 채널에 반영합니다.</p>
            {syncPreview && !syncPreview.inSync && (
              <ul className="mt-2 list-disc pl-5 text-base">
                {syncSummaryLines(syncPreview).map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            )}
          </div>
        }
        confirmText="반영하기"
        onConfirm={handlePropagateConfirm}
        onCancel={() => setConfirmOpen(false)}
      />

      {/* 옵션명 일괄 적용 확인(2609_22/D4). 기존 공통 모달 재사용 — 신규 확인 모달을 만들지 말 것. */}
      <ConfirmDialog
        isOpen={applyNamesOpen}
        title="옵션명 일괄 적용"
        message="채널에서 따로 지정한 옵션명이 마스터 옵션명으로 되돌아갑니다. 진행할까요?"
        confirmText="적용하기"
        onConfirm={handleApplyNamesConfirm}
        onCancel={() => setApplyNamesOpen(false)}
      />

      {/* 마스터 삭제 확인(2609_72). 문구는 목록의 확인창과 같은 것을 쓴다 — 하드 삭제라 무엇이
          함께 사라지는지 숫자와 함께 말해야 한다. ⚠️ 이번 범위에서는 목록 쪽을 손대지 않으므로
          문구가 두 곳에 있다(공통화는 하지 않는다). */}
      <ConfirmDialog
        isOpen={deleteOpen}
        title="마스터 삭제"
        confirmText="삭제"
        isDangerous
        isLoading={isDeleting}
        onConfirm={handleDelete}
        onCancel={() => setDeleteOpen(false)}
        message={
          <div className="space-y-2 text-left">
            <p>
              <span className="font-medium">{master?.name ?? matrix?.masterName}</span> 을(를)
              삭제합니다.
              <span className="text-red-600"> 되돌릴 수 없습니다.</span>
            </p>
            <ul className="list-disc pl-5 text-sm text-gray-600">
              <li>
                옵션 {master?.options.length}개 · 구성상품 {master?.components.length}개와 사진이 함께
                삭제됩니다
              </li>
              <li>마켓에 올리지 않은 채널은 함께 삭제됩니다</li>
              <li>마켓에 올린 채널이 있으면 삭제되지 않습니다 — 먼저 [연결 해제] 하세요</li>
              <li>
                연결 해제한 판매상품이 이 마스터의 사진을 쓰고 있었다면 상세 이미지가 깨질 수 있습니다
              </li>
            </ul>
          </div>
        }
      />

      {/* 채널 매트릭스 = **계정 헤더 + 판매상품 행(기본 접힘)** 목록(2026-09-26). 종전 표(계정 × 셀 행,
          10열)는 가로 스크롤이 생기고 행마다 판매자·플랫폼·계정이 반복됐다.
          🔴 폭을 고정하는 칸이 없다 — 가로 스크롤을 만들지 말 것(`list-table-scroll`·min-width 금지).
          ⚠️ 조치가 필요한 계정·판매상품이 먼저 온다(`sortedRows`·`sortedCells`, 나머지는 응답 순서 그대로). */}
      <div className="rounded-lg bg-white shadow">
        {isLoading ? (
          <div className="flex min-h-32 items-center justify-center">
            <Spinner size={24} label="불러오는 중..." />
          </div>
        ) : !matrix || matrix.rows.length === 0 ? (
          <p className="px-4 py-6 text-center text-sm text-gray-500">
            등록된 판매채널 계정이 없습니다.
          </p>
        ) : (
          <div>
            {isAdmin && unregisteredRows.length > 0 && (
              <div className="flex items-center border-b border-gray-200 px-4 py-2">
                <label className="flex items-center gap-2 text-xs text-gray-600">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={toggleAll}
                    disabled={busy || selectableRows.length === 0}
                  />
                  미등록 계정 전체 선택
                </label>
              </div>
            )}
            {sortedRows.map((row) => {
              const rowCells = sortedCells(rowCellsOf(row));
              const multiCell = rowCells.length > 1;
              // 모달·확인창 제목용 라벨. 셀이 여럿이면 어느 쿠팡 페이지인지 꼬리표를 붙인다.
              const cellLabel = (c: MatrixCell) =>
                `${row.sellerName} · ${row.platform}${multiCell ? ` · ${cellTag(c)}` : ''}`;
              const canRegister = !row.registered || rowCells.length === 0;
              const actionCount = rowCells.reduce((sum, c) => sum + cellActionCount(c), 0);
              return (
                <section
                  key={row.accountId}
                  className="border-b border-gray-200 last:border-b-0"
                >
                  {/* 계정 헤더: 플랫폼 · 계정명 / 판매자 / 판매상품 수 / 오른쪽 「조치 필요 N」 + 계정 단위 액션. */}
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 bg-gray-50 px-4 py-2.5">
                    {isAdmin && canRegister && (
                      // 체크박스 일괄 등록은 **계정 단위**다.
                      <input
                        type="checkbox"
                        checked={selected.has(row.accountId) && !isShippingBlocked(row.accountId)}
                        onChange={() => toggleOne(row.accountId)}
                        disabled={busy || isShippingBlocked(row.accountId)}
                        title={isShippingBlocked(row.accountId) ? SHIPPING_BLOCK_REASON : undefined}
                        aria-label={`${row.sellerName} ${row.platform} 선택`}
                      />
                    )}
                    <span className="min-w-0 truncate text-sm font-semibold text-gray-900">
                      {row.platform} · {row.accountLabel}
                    </span>
                    <span className="min-w-0 truncate text-sm text-gray-600">{row.sellerName}</span>
                    {rowCells.length > 0 ? (
                      <span className="text-xs text-gray-500">판매상품 {rowCells.length}개</span>
                    ) : (
                      <span className="rounded bg-gray-200 px-1.5 py-0.5 text-[11px] text-gray-600">
                        미등록
                      </span>
                    )}
                    <div className="ml-auto flex flex-wrap items-center gap-2">
                      {actionCount > 0 && (
                        <span
                          className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-800"
                          title="변경 미반영 · 카테고리 불일치 칩의 합"
                        >
                          조치 필요 {actionCount}
                        </span>
                      )}
                      {isAdmin && canRegister && (
                        // 🔴 [등록] = 채널 셀 **생성**이라 미등록 계정 전용이다(계정당 1셀 가드 409).
                        <button
                          type="button"
                          onClick={() => handleRowAdd(row.accountId, row.sellerId, row.platform)}
                          disabled={busy || isShippingBlocked(row.accountId)}
                          title={isShippingBlocked(row.accountId) ? SHIPPING_BLOCK_REASON : undefined}
                          className="flex items-center gap-1 rounded border border-blue-300 bg-white px-2 py-1 text-xs font-medium text-blue-700 hover:bg-blue-50 disabled:opacity-50"
                        >
                          {rowBusyId === row.accountId ? (
                            <Spinner size={12} label="등록 중" />
                          ) : (
                            '등록'
                          )}
                        </button>
                      )}
                      {/* 2609_22: 이미 마켓에 올라간 상품을 이 계정의 셀로 편입. 셀을 지목하지 않는
                          계정 단위 액션이라 헤더에 둔다(등록된 계정에도 — 두 번째 쿠팡 페이지의 입구).
                          ⚠️ 출고지 가드를 걸지 않는다 — 이미 팔고 있는 상품이다. */}
                      {isAdmin && row.platform === 'COUPANG' && (
                        <button
                          type="button"
                          onClick={() =>
                            setImportTarget({
                              sellerId: row.sellerId,
                              platform: row.platform,
                              sellerName: row.sellerName,
                            })
                          }
                          disabled={busy}
                          className="rounded border border-gray-300 bg-white px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-100 disabled:opacity-50"
                        >
                          {canRegister ? '가져오기' : '쿠팡 상품 추가'}
                        </button>
                      )}
                    </div>
                    {isAdmin && canRegister && isShippingBlocked(row.accountId) && (
                      <p className="basis-full text-[11px] text-amber-700" title={SHIPPING_BLOCK_REASON}>
                        배송 설정 필요 — 판매채널 관리 &gt; 배송관리에서 출고지·반품지를 먼저 지정하세요.
                      </p>
                    )}
                  </div>
                  {rowCells.map((cell) => (
                    <ListingRow
                      key={cell.productListingId}
                      masterId={masterId}
                      cell={cell}
                      gen={generated[cell.productListingId]}
                      genLoading={genLoading}
                      channelOptions={channelOptionsByListingId.get(cell.productListingId)}
                      channelOptionsLoading={channelOptionCells == null && !channelOptionError}
                      masterOptions={options}
                      isAdmin={isAdmin}
                      channelLabel={cellLabel(cell)}
                      accountId={row.accountId}
                      platform={row.platform}
                      optionBusy={optionBusyId === cell.productListingId}
                      onToggleOption={handleToggleOption}
                      onEditMasterOption={handleEditMasterOption}
                      onReload={load}
                      onPreview={openPreview}
                      shippingUseCase={shippingUseCase}
                      onShippingSaved={handleShippingSaved}
                      masterCategoryName={matrix.masterCategoryName ?? null}
                      onCellRemoved={handleCellRemoved}
                    />
                  ))}
                </section>
              );
            })}
          </div>
        )}
      </div>

      <p className="text-[11px] text-amber-700">
        {`${MARKET_OPTION_LOCK_REASON} 옵션 추가는 언제든 가능합니다.`}
      </p>

      {/* 2609_61: 옵션 × 채널 표. ⚠️ `DetailSection` 은 처음 펼칠 때 children 을 마운트한다 →
          표를 열지 않으면 `channel-options` 도 부르지 않는다(의도).
          🔴 ADMIN 게이트 필수 — `channel-options` 는 `/api/admin/**` 이고 이 페이지는 비-ADMIN 도
          열리므로, 게이트가 없으면 펼치는 순간 403 이다(90 의 `fetchSyncPreview` 와 같은 이유).
          [옵션 수정] 의 도착지인 「상품 기본 정보」도 ADMIN 에게만 렌더된다. */}
      {isAdmin && master && (
        <DetailSection title="채널별 옵션" summary={channelOptionSummary}>
          <ChannelOptionTable
            rows={matrix?.rows ?? []}
            masterOptions={options}
            cells={channelOptionCells}
            error={channelOptionError}
            onEditMasterOption={handleEditMasterOption}
          />
        </DetailSection>
      )}

      {/* 마스터 편집 = 토글 섹션 스택(83A/83B). 순서 = 상품 기본 정보(기본 정보·표준 카테고리·
          카테고리 필수속성·고시·옵션·이미지) → 템플릿 필드값 → 기본 택배/상자 → 태그 →
          등록상품명 접미사 → 배송 설정. ⚠️ 마스터 편집 지점은 이 상세 페이지 하나다(모달은 생성 전용). */}
      {/* 상품 기본 정보 = 기본 정보 + 표준 카테고리 + 카테고리 필수속성·고시 + 옵션 + 이미지 한
          토글(사용자 요청 2026-08-29). 상품 자체를 이루는 값이라 함께 열어 본다 → 다시 쪼개지 말 것.
          2609_73: 겉 토글은 **그대로 하나**이고 그 안만 탭 5개다(세로로 쌓이던 블록 5개 → 한 번에 하나).
          블록 순서 = 입력 의존 순서 그대로 **= 탭 순서** = 카테고리 → 그 카테고리의 필수속성·고시 →
          옵션(마스터 필수속성 값을 상속) → 이미지. ⚠️ 펼치면 **첫 탭(기본 정보)만** 마운트된다 —
          카테고리 메타·옵션 스키마 조회와 이미지 풀 조회는 **그 탭을 처음 열 때** 일어난다(탭 단위
          lazy mount). 한 번 본 탭은 `hidden` 으로 남아 미저장 입력을 지킨다.
          ⚠️ 두 카테고리 패널은 `master` 가 로드된 뒤에만 렌더된다(그룹 조건) — 예전 단독 섹션은
          `isAdmin` 만 봤다. */}
      {isAdmin && master && (
        <DetailSection title="상품 기본 정보" summary={basicSummary} openSignal={basicOpenSignal}>
          <BasicInfoTabs
            openTab={basicOpenTab}
            panes={{
              basic: (
                <MasterBasicInfoPanel
                  master={master}
                  useCase={masterUseCase}
                  onSaved={handlePanelSaved}
                />
              ),
              category: (
                <MasterCategoryPanel
                  masterId={masterId}
                  useCase={masterUseCase}
                  categoryUseCase={categoryUseCase}
                  mappingUseCase={mappingUseCase}
                  onCategoryChanged={setCategory}
                />
              ),
              meta: (
                <CategoryMetaPanel
                  masterId={masterId}
                  categoryCode={category ? String(category.categoryId) : null}
                  isBundle={isBundle}
                  onSaved={() => setMetaVersion((v) => v + 1)}
                />
              ),
              options: (
                <div className="space-y-2 p-4">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="text-sm font-semibold text-gray-900">옵션 (수량조합)</h3>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setApplyNamesOpen(true)}
                        disabled={options.length === 0 || isApplyingNames}
                        className="rounded border border-gray-300 px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-100 disabled:opacity-50"
                      >
                        옵션명 일괄 적용
                      </button>
                    </div>
                  </div>
                  <p className="text-[11px] text-gray-500">
                    옵션의 카테고리 필수속성은 저장된 마스터 값을 기준으로 상속 여부를 판단합니다.
                    [필수속성 · 고시] 탭에서 저장한 뒤 입력하세요.
                  </p>
                  {metaBaseError && (
                    <p className="rounded bg-amber-50 px-3 py-2 text-xs text-amber-700">
                      {metaBaseError}
                    </p>
                  )}
                  <MasterOptionEditor
                    master={master}
                    useCase={masterUseCase}
                    carrierRates={carrierRates}
                    packages={packages}
                    masterDefaults={optionMasterDefaults}
                    categoryId={categoryId}
                    masterAttrValues={masterAttrValues}
                    masterNoticeValues={masterNoticeValues}
                    masterNoticeGroup={masterNoticeGroup}
                    hideCategoryAttrs={hideCategoryAttrs}
                    onChanged={load}
                    focusOption={focusOption}
                  />
                </div>
              ),
              images: (
                <div className="space-y-2 p-4">
                  <h3 className="text-sm font-semibold text-gray-900">이미지</h3>
                  <p className="text-[11px] text-gray-500">변경 즉시 저장됩니다.</p>
                  <MasterImagePool
                    masterId={masterId}
                    detailUseCase={detailUseCase}
                    fields={imageFields}
                    fieldFilters={imageFieldFilters}
                    productImageUseCase={productImageUseCase}
                    sourceProducts={sourceProducts}
                  />
                </div>
              ),
            }}
          />
        </DetailSection>
      )}

      {isAdmin && master && (
        <DetailSection title="템플릿 필드값" summary={fieldValuesSummary}>
          <MasterFieldValuesPanel
            master={master}
            useCase={masterUseCase}
            templateUseCase={templateUseCase}
            onSaved={handlePanelSaved}
          />
        </DetailSection>
      )}

      {isAdmin && master && (
        <DetailSection title="기본 택배/상자" summary={defaultCostSummary}>
          <MasterDefaultCostPanel
            master={master}
            useCase={masterUseCase}
            carrierRates={carrierRates}
            packages={packages}
            onSaved={handlePanelSaved}
          />
        </DetailSection>
      )}

      {isAdmin && master && (
        <DetailSection title="등록상품명 · 태그" summary={tagsSummary}>
          <MasterTagsPanel master={master} useCase={masterUseCase} onSaved={handlePanelSaved} />
        </DetailSection>
      )}

      {isAdmin && (
        <DetailSection title="등록상품명 추가 문구" summary={suffixSummary}>
          <MasterRegistrationSuffixPanel
            masterId={masterId}
            useCase={masterUseCase}
            onSaved={load}
          />
        </DetailSection>
      )}

      {isAdmin && (
        <DetailSection title="배송 설정 (전 채널)" summary={shippingSummary}>
          <MasterShippingOverridePanel
            masterId={masterId}
            useCase={masterUseCase}
            channels={forceApplyChannels}
            onSaved={load}
          />
        </DetailSection>
      )}

      {importTarget && (
        <ImportCoupangProductModal
          masterId={masterId}
          sellerId={importTarget.sellerId}
          platform={importTarget.platform}
          sellerName={importTarget.sellerName}
          onClose={() => setImportTarget(null)}
          onDone={handleImportDone}
        />
      )}

      <ChannelPreviewModal data={preview} onClose={() => setPreview(null)} />
    </PageContainer>
  );
}
