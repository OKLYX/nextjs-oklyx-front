'use client';

import { Fragment, useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { PageContainer } from '@/presentation/components/PageContainer';
import { Spinner } from '@/presentation/components/Spinner';
import { useAuthStore } from '@/infrastructure/stores/authStore';
import { ROUTES } from '@/config/routes';
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
  ListingMatrixResponse,
  MasterCategoryResponse,
  MasterOptionResponse,
  MasterProductResponse,
} from '@/domain/entities/MasterProductEntity';
import type { CarrierRate } from '@/domain/entities/CarrierRateEntity';
import type { Package } from '@/domain/entities/PackageEntity';
import type {
  ListingStatus,
  GeneratedProductResponse,
  ChannelSyncPreview,
  ChannelSyncChannel,
} from '@/domain/entities/ListingRegistrationEntity';
import { resolveThumbUrl } from '@/infrastructure/utils/thumbUrl';
import { extractErrorMessage } from '@/infrastructure/utils/errorMessage';
import {
  DetailHtmlThumb,
  ChannelPreviewModal,
  type ChannelPreviewData,
} from '@/presentation/components/DetailHtmlPreview';
import { MasterOptionEditor } from '../../components/MasterOptionEditor';
import {
  MasterImagePool,
  type ImageField,
  type ImageFieldGroup,
} from '../../components/MasterImagePool';
import { deriveMasterImageFields } from '../../components/masterImageFields';
import { submitNoticeGroup } from './categoryMetaValidation';
import { DetailSection } from './DetailSection';
import { MasterCategoryPanel } from './MasterCategoryPanel';
import { CategoryMetaPanel } from './CategoryMetaPanel';
import { MasterBasicInfoPanel } from './MasterBasicInfoPanel';
import { MasterFieldValuesPanel } from './MasterFieldValuesPanel';
import { MasterDefaultCostPanel, carrierLabel, packageLabel } from './MasterDefaultCostPanel';
import { MasterTagsPanel } from './MasterTagsPanel';
import { MasterRegistrationSuffixPanel } from './MasterRegistrationSuffixPanel';
import { MasterShippingOverridePanel } from './MasterShippingOverridePanel';
import { CellActions } from './CellActions';
import { DisplayNameRow } from './DisplayNameRow';
import { PopupDialogModal } from '@/presentation/components/PopupDialogModal';

interface CoverageMatrixProps {
  id: string;
}

const formatWon = (v: number) => `${v.toLocaleString('ko-KR')}원`;

/**
 * 마스터 상세 = 채널 체크목록(계정 × 리스팅) + 미등록 일괄/행별 등록 + 전파 배선.
 * File: src/app/dashboard/master-products/[id]/components/CoverageMatrix.tsx
 *
 * 채널(판매자×플랫폼)은 판매채널 관리 화면에서 정의됨 → 여기선 다시 선택하지 않는다.
 * 매트릭스 행이 곧 테넌트 전 채널 목록(registered 플래그). 미등록 행을 체크해 일괄 등록하거나
 * 행별 [등록] 원클릭으로 등록한다. 옵션은 15에서 전체 복사되므로 옵션 선택 UI 없음.
 */
/**
 * 출고지·반품지가 없는 판매자에 채널을 만들 수 없는 이유(사용자 결정 2026-08-28). 그 판매자의 채널은
 * 전부 배송 정보가 비게 되므로 생성 자체를 막고, 판매자 배송 설정을 먼저 끝내게 안내한다.
 */
const SHIPPING_BLOCK_REASON =
  '이 판매자의 출고지·반품지가 지정되지 않아 채널을 만들 수 없습니다. 판매채널 관리 > 배송관리에서 출고지·반품지를 먼저 지정하세요.';

/**
 * 마켓에 이미 올라간 옵션은 뺄 수 없는 이유(사용자 결정 2026-08-29). 승인된 마켓 옵션은 물리적으로
 * 삭제되지 않아 백엔드(87)가 해제를 400 으로 막는다 → 화면이 먼저 체크박스를 잠근다.
 */
const MARKET_OPTION_LOCK_REASON = '마켓에 등록된 옵션은 뺄 수 없습니다.';

/**
 * 채널 반영 요약 줄(90). 배너와 확인 모달이 **같은 문구**를 쓰도록 여기서 한 번만 만든다 —
 * 두 곳에 복붙하지 말 것. 0 인 항목은 생략한다.
 *
 * ⚠️ `marketOrphanOptions` 는 반영이 손대지 않으므로(89 규칙) 여기 건수에 포함하지 않는다.
 */
const syncSummaryLines = (preview: ChannelSyncPreview): string[] => {
  const t = preview.totals;
  const lines: string[] = [];
  if (t.missingOptions > 0) lines.push(`채널에 없는 옵션 ${t.missingOptions}`);
  if (t.orphanOptions > 0) lines.push(`마스터에 없는 옵션 ${t.orphanOptions}`);
  if (t.quantityMismatch > 0) lines.push(`수량이 다른 옵션 ${t.quantityMismatch}`);
  return lines;
};

/** 배너 건수 = 옵션 건수 합(채널 수가 아니다 — 버튼 배지가 채널 수). */
const syncOptionCount = (preview: ChannelSyncPreview): number =>
  preview.totals.missingOptions + preview.totals.orphanOptions + preview.totals.quantityMismatch;

/** 한 채널 줄의 `{항목 라벨}: {옵션명, 옵션명}` 조각들(0 인 항목 생략). 회색 안내 항목은 제외. */
const channelDiffText = (c: ChannelSyncChannel): string => {
  const parts: string[] = [];
  if (c.missingOptions.length > 0) parts.push(`채널에 없는 옵션: ${c.missingOptions.join(', ')}`);
  if (c.orphanOptions.length > 0) parts.push(`마스터에 없는 옵션: ${c.orphanOptions.join(', ')}`);
  if (c.quantityMismatchOptions.length > 0)
    parts.push(`수량이 다른 옵션: ${c.quantityMismatchOptions.join(', ')}`);
  return parts.join(' · ');
};

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
  // MasterImagePool field derivation (대표사진 + 전 템플릿 imageZone union).
  const [imageFields, setImageFields] = useState<ImageField[]>([]);
  const [imageFieldGroups, setImageFieldGroups] = useState<ImageFieldGroup[]>([]);
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

  // Open the tabbed preview modal for a channel, on the given initial tab.
  const openPreview = (
    gen: GeneratedProductResponse | null,
    sellerName: string,
    platform: string,
    initialTab: 'image' | 'detail',
  ) => {
    setPreview({
      imageSrc: gen?.thumbnailUrl ? resolveThumbUrl(gen.thumbnailUrl) : null,
      html: gen?.detailHtml ?? null,
      title: `${sellerName} · ${platform}`,
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
  // 반영 전 미리보기(90). null = 미로드/조회 중/실패/비-ADMIN → 아무것도 주장하지 않는다
  // (배너 숨김 + 버튼은 기존대로 활성). 로딩 전용 스피너를 두지 않는 이유이기도 하다.
  const [syncPreview, setSyncPreview] = useState<ChannelSyncPreview | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  // Per-channel option activation (43): the listing id currently saving an active-set change.
  const [optionBusyId, setOptionBusyId] = useState<number | null>(null);

  // Fetch per-channel generated assets (thumbnail + detail HTML) in one call each,
  // N calls total, without blocking the table render. Each failure is absorbed as
  // null so one bad channel never stalls the rest.
  const fetchGenerated = useCallback(
    async (m: ListingMatrixResponse) => {
      const registered = m.rows.filter((r) => r.cell).map((r) => r.cell!.productListingId);
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
      const accountIds = m.rows.filter((r) => !r.registered || !r.cell).map((r) => r.accountId);
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
    } catch {
      setError('커버리지 매트릭스를 불러오지 못했습니다.');
    } finally {
      setIsLoading(false);
    }
  }, [masterUseCase, masterId, fetchGenerated, fetchPlaces, fetchSyncPreview]);

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
          packageUseCase.getPackages(),
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

  // 이미지 필드(대표사진 + 전 템플릿 imageZone union). 생성 모달과 같은 도출 헬퍼를 쓴다.
  useEffect(() => {
    let alive = true;
    void (async () => {
      const { fields, fieldGroups } = await deriveMasterImageFields(detailUseCase);
      if (!alive) return;
      setImageFields(fields);
      setImageFieldGroups(fieldGroups);
    })();
    return () => {
      alive = false;
    };
  }, [detailUseCase]);

  const unregisteredRows = useMemo(
    () => matrix?.rows.filter((r) => !r.registered) ?? [],
    [matrix],
  );

  // Registered cells = the force-apply selection list (79). Same label as the channel modal header.
  // `override` (81) lets the panel tell which channels hold their own settings and so would not
  // receive a master save. ⚠️ `generated` must stay in the deps — it fills in after the table renders,
  // and without it every channel would stay `undefined` (= unknown) and the hint could never appear.
  const forceApplyChannels = useMemo(
    () =>
      (matrix?.rows ?? [])
        .filter((r) => r.cell)
        .map((r) => ({
          listingId: r.cell!.productListingId,
          label: `${r.sellerName} · ${r.platform}`,
          // undefined = not loaded yet / fetch failed → excluded from the hint (never over-report).
          override: generated[r.cell!.productListingId]?.shippingOverride,
        })),
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
  // 그룹 요약 = 이름·상태 + 카테고리 + 필수속성 수 + 옵션 수 + 대표사진 유무(접힌 채로 그룹 안 다섯
  // 블록 상태를 읽게). ⚠️ 위 세 파생값은 여기서 즉시 읽히므로 반드시 basicSummary **앞**에 둔다.
  const basicSummary = master
    ? `${master.name}${master.active ? '' : ' · 비활성'} · ${categorySummary} · 필수속성 ${
        metaFilledCount
      }개 · 옵션 ${options.length}개 · ${
        master.sourceImageUrl ? '대표사진 있음' : '대표사진 없음'
      }`
    : undefined;
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

  // [채널에 반영하기] = 확인 모달만 연다. PopupDialogModal 은 선언형이라 window.confirm 처럼
  // 한 줄로 치환할 수 없어 핸들러를 열기/실행 둘로 쪼갠다.
  const handlePropagateClick = () => setConfirmOpen(true);

  const handlePropagateConfirm = async () => {
    // ⚠️ PopupDialogModal 에 disabled prop 이 없다 → 재진입 가드는 호출부 책임
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
      if (res.registrationName != null) {
        setMatrix((prev) =>
          prev && {
            ...prev,
            rows: prev.rows.map((r) =>
              r.cell?.productListingId === listingId
                ? { ...r, cell: { ...r.cell, registrationName: res.registrationName! } }
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

  // Matrix cell can't distinguish SUBMITTED/SELLING; map registered+platformProductId
  // to an initial status. CellActions upgrades it after a fetch-status refresh.
  const initialStatus = (platformProductId: string | null): ListingStatus =>
    platformProductId ? 'SUBMITTED' : 'DRAFT';

  const busy = isBatchAdding || rowBusyId !== null;

  return (
    <PageContainer>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => router.push(ROUTES.MASTER_PRODUCTS)}
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

      {banner && (
        <p
          className={`rounded px-3 py-2 text-sm ${
            banner.tone === 'green' ? 'bg-green-50 text-green-700' : 'bg-amber-50 text-amber-700'
          }`}
        >
          {banner.text}
        </p>
      )}

      {/* 반영 전 요약(90): 무엇이 반영되는지 누르기 전에 보여준다. ⚠️ marketOrphanOptions 만 있는
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
                {c.marketOrphanOptions.length > 0 && (
                  <span className="text-gray-500">
                    {channelDiffText(c) ? ' ' : `${c.sellerName} · ${c.platform} — `}
                    마스터에 없는데 판매 중: {c.marketOrphanOptions.join(', ')} (WING에서 직접 중지)
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
        syncPreview.channels.some((c) => c.marketOrphanOptions.length > 0) && (
          <ul className="list-disc rounded px-3 py-2 pl-8 text-xs text-gray-500">
            {syncPreview.channels
              .filter((c) => c.marketOrphanOptions.length > 0)
              .slice(0, 5)
              .map((c) => (
                <li key={c.listingId}>
                  {c.sellerName} · {c.platform} — 마스터에 없는데 판매 중:{' '}
                  {c.marketOrphanOptions.join(', ')} (WING에서 직접 중지)
                </li>
              ))}
          </ul>
        )}

      {error && <p className="rounded bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      {/* 반영 확인(90): 기존 공통 모달 재사용 — 신규 확인 모달을 만들지 말 것(82 선례). */}
      <PopupDialogModal
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

      {/* 마스터 편집 = 토글 섹션 스택(83A/83B). 순서 = 상품 기본 정보(기본 정보·표준 카테고리·
          카테고리 필수속성·고시·옵션·이미지) → 템플릿 필드값 → 기본 택배/상자 → 태그 →
          등록상품명 접미사 → 배송 설정. ⚠️ 마스터 편집 지점은 이 상세 페이지 하나다(모달은 생성 전용). */}
      {/* 상품 기본 정보 = 기본 정보 + 표준 카테고리 + 카테고리 필수속성·고시 + 옵션 + 이미지 한
          토글(사용자 요청 2026-08-29). 상품 자체를 이루는 값이라 함께 열어 본다 → 다시 쪼개지 말 것.
          블록 순서 = 입력 의존 순서 그대로 = 카테고리 → 그 카테고리의 필수속성·고시 → 옵션(마스터
          필수속성 값을 상속) → 이미지. ⚠️ 이 그룹을 펼치면 카테고리 메타·옵션 스키마 조회와 이미지 풀
          조회가 함께 일어난다(그룹 단위 lazy mount). ⚠️ 두 카테고리 패널은 `master` 가 로드된 뒤에만
          렌더된다(그룹 조건) — 예전 단독 섹션은 `isAdmin` 만 봤다. */}
      {isAdmin && master && (
        <DetailSection title="상품 기본 정보" summary={basicSummary}>
          <MasterBasicInfoPanel
            master={master}
            useCase={masterUseCase}
            onSaved={handlePanelSaved}
          />

          <MasterCategoryPanel
            masterId={masterId}
            useCase={masterUseCase}
            categoryUseCase={categoryUseCase}
            mappingUseCase={mappingUseCase}
            onCategoryChanged={setCategory}
          />

          <CategoryMetaPanel
            masterId={masterId}
            categoryCode={category ? String(category.categoryId) : null}
            isBundle={isBundle}
            onSaved={() => setMetaVersion((v) => v + 1)}
          />

          <div className="space-y-2 border-t border-gray-200 p-4">
            <h3 className="text-sm font-semibold text-gray-900">옵션 (수량조합)</h3>
            <p className="text-[11px] text-gray-500">
              옵션의 카테고리 필수속성은 저장된 마스터 값을 기준으로 상속 여부를 판단합니다. 위
              [카테고리 필수속성 · 고시]에서 저장한 뒤 입력하세요.
            </p>
            {metaBaseError && (
              <p className="rounded bg-amber-50 px-3 py-2 text-xs text-amber-700">{metaBaseError}</p>
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
            />
          </div>

          <div className="space-y-2 border-t border-gray-200 p-4">
            <h3 className="text-sm font-semibold text-gray-900">이미지</h3>
            <p className="text-[11px] text-gray-500">변경 즉시 저장됩니다.</p>
            <MasterImagePool
              masterId={masterId}
              detailUseCase={detailUseCase}
              fields={imageFields}
              fieldGroups={imageFieldGroups}
              productImageUseCase={productImageUseCase}
              sourceProducts={sourceProducts}
            />
          </div>
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

      <div className="rounded-lg bg-white shadow list-table-scroll">
        {isLoading ? (
          <div className="flex min-h-32 items-center justify-center">
            <Spinner size={24} label="불러오는 중..." />
          </div>
        ) : !matrix || matrix.rows.length === 0 ? (
          <p className="px-4 py-6 text-center text-sm text-gray-500">
            등록된 판매채널 계정이 없습니다.
          </p>
        ) : (
          <table>
            <thead>
              <tr className="border-b border-gray-200 text-left text-sm text-gray-600">
                <th className="px-4 py-3">
                  {isAdmin && unregisteredRows.length > 0 ? (
                    <label className="flex items-center gap-1 text-xs font-normal">
                      <input
                        type="checkbox"
                        checked={allSelected}
                        onChange={toggleAll}
                        disabled={busy || selectableRows.length === 0}
                      />
                      미등록 전체
                    </label>
                  ) : null}
                </th>
                <th className="px-4 py-3">썸네일</th>
                <th className="px-4 py-3">상세페이지</th>
                <th className="px-4 py-3">판매자</th>
                <th className="px-4 py-3">플랫폼</th>
                <th className="px-4 py-3">계정</th>
                <th className="px-4 py-3">상태</th>
                <th className="px-4 py-3">판매가</th>
                <th className="px-4 py-3">액션</th>
              </tr>
            </thead>
            <tbody>
              {matrix.rows.map((row) => {
                const badge = !row.registered
                  ? '미등록'
                  : row.cell?.platformProductId
                    ? '등록됨'
                    : 'DRAFT';
                return (
                  <Fragment key={row.accountId}>
                  <tr
                    className="border-b border-gray-100 text-sm text-gray-900"
                  >
                    <td className="px-4 py-3">
                      {isAdmin && !row.registered ? (
                        <input
                          type="checkbox"
                          checked={selected.has(row.accountId) && !isShippingBlocked(row.accountId)}
                          onChange={() => toggleOne(row.accountId)}
                          disabled={busy || isShippingBlocked(row.accountId)}
                          title={
                            isShippingBlocked(row.accountId)
                              ? SHIPPING_BLOCK_REASON
                              : undefined
                          }
                        />
                      ) : null}
                    </td>
                    <td className="px-4 py-3 align-top">
                      {(() => {
                        if (!row.cell) return <span className="text-gray-400">–</span>;
                        const gen = generated[row.cell.productListingId];
                        if (gen === undefined) {
                          return genLoading ? (
                            <Spinner size={14} />
                          ) : (
                            <span className="text-gray-400">–</span>
                          );
                        }
                        const url = gen?.thumbnailUrl;
                        if (!url) return <span className="text-gray-400">–</span>;
                        const resolved = resolveThumbUrl(url);
                        return (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={resolved}
                            alt={`${row.sellerName} 썸네일`}
                            onClick={() => openPreview(gen, row.sellerName, row.platform, 'image')}
                            className="h-24 w-24 cursor-pointer rounded border border-gray-200 object-contain hover:opacity-80"
                          />
                        );
                      })()}
                    </td>
                    <td className="px-4 py-3 align-top">
                      {(() => {
                        if (!row.cell) return <span className="text-gray-400">–</span>;
                        const gen = generated[row.cell.productListingId];
                        if (gen === undefined) {
                          return genLoading ? (
                            <Spinner size={14} />
                          ) : (
                            <span className="text-gray-400">–</span>
                          );
                        }
                        const html = gen?.detailHtml;
                        if (!html) return <span className="text-xs text-gray-400">미생성</span>;
                        return (
                          <DetailHtmlThumb
                            html={html}
                            width={96}
                            height={96}
                            onClick={() => openPreview(gen, row.sellerName, row.platform, 'detail')}
                          />
                        );
                      })()}
                    </td>
                    <td className="px-4 py-3">{row.sellerName}</td>
                    <td className="px-4 py-3">{row.platform}</td>
                    <td className="px-4 py-3">{row.accountLabel}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded px-1.5 py-0.5 text-[10px] ${
                          !row.registered
                            ? 'bg-gray-100 text-gray-500'
                            : row.cell?.platformProductId
                              ? 'bg-green-100 text-green-700'
                              : 'bg-amber-100 text-amber-700'
                        }`}
                      >
                        {badge}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {(() => {
                        if (!row.cell) return <span className="text-gray-400">–</span>;
                        // Prefer per-option prices (a master can have many options with
                        // distinct prices); fall back to the single representative price.
                        const prices = generated[row.cell.productListingId]?.optionPrices ?? [];
                        if (prices.length === 0) {
                          return row.cell.sellingPrice != null ? (
                            formatWon(row.cell.sellingPrice)
                          ) : (
                            <span className="text-gray-400">–</span>
                          );
                        }
                        // Inline per-option active toggle (43): checkbox = market inclusion, unchecked =
                        // greyed. Non-admins see a plain read-only list (no checkbox).
                        const listingId = row.cell.productListingId;
                        return (
                          <div className="space-y-0.5">
                            {prices.map((p) => {
                              const active = p.active !== false;
                              // On the market and still on -> can't be turned off (87 returns 400).
                              const lockedOff = p.onMarket === true && active;
                              // Prefer the name the backend sends with each price. Fall back to the
                              // master option lookup (legacy responses), then the raw id.
                              const name = p.optionName
                                ?? options.find((o) => o.id === p.optionId)?.name
                                ?? `옵션 #${p.optionId}`;
                              const label = (
                                <span className={active ? '' : 'text-gray-400'}>
                                  <span className={active ? 'text-gray-500' : ''}>{name}: </span>
                                  {formatWon(p.sellingPrice)}
                                </span>
                              );
                              return isAdmin ? (
                                <label
                                  key={p.optionId}
                                  className="flex items-center gap-1.5 whitespace-nowrap text-xs"
                                  // Tooltip lives on the label: a disabled input doesn't fire the
                                  // hover events browsers need to show `title`.
                                  title={
                                    lockedOff
                                      ? `${MARKET_OPTION_LOCK_REASON} 판매를 멈추려면 쿠팡 WING 에서 처리하세요.`
                                      : undefined
                                  }
                                >
                                  <input
                                    type="checkbox"
                                    checked={active}
                                    disabled={optionBusyId === listingId || lockedOff}
                                    onChange={() => handleToggleOption(listingId, p.optionId)}
                                  />
                                  {label}
                                  {lockedOff && <span className="text-gray-400">🔒</span>}
                                </label>
                              ) : (
                                <div key={p.optionId} className="whitespace-nowrap text-xs">
                                  {label}
                                </div>
                              );
                            })}
                          </div>
                        );
                      })()}
                    </td>
                    <td className="px-4 py-3">
                      {!isAdmin ? (
                        <span className="text-xs text-gray-400">–</span>
                      ) : !row.registered || !row.cell ? (
                        <div className="space-y-1">
                          <button
                            type="button"
                            onClick={() =>
                              handleRowAdd(row.accountId, row.sellerId, row.platform)
                            }
                            disabled={busy || isShippingBlocked(row.accountId)}
                            title={isShippingBlocked(row.accountId) ? SHIPPING_BLOCK_REASON : undefined}
                            className="flex items-center gap-1 rounded border border-blue-300 px-2 py-1 text-xs font-medium text-blue-700 hover:bg-blue-50 disabled:opacity-50"
                          >
                            {rowBusyId === row.accountId ? <Spinner size={12} label="등록 중" /> : '등록'}
                          </button>
                          {isShippingBlocked(row.accountId) && (
                            <p className="text-[11px] text-amber-700" title={SHIPPING_BLOCK_REASON}>
                              배송 설정 필요
                            </p>
                          )}
                        </div>
                      ) : (
                        <CellActions
                          masterId={masterId}
                          listing={{
                            id: row.cell.productListingId,
                            status: initialStatus(row.cell.platformProductId),
                          }}
                          options={options}
                          onReload={load}
                          accountId={row.accountId}
                          platform={row.platform}
                          channelLabel={`${row.sellerName} · ${row.platform}`}
                          shippingOverride={generated[row.cell.productListingId]?.shippingOverride}
                          shippingReady={generated[row.cell.productListingId]?.shippingReady}
                          shippingUseCase={shippingUseCase}
                          onShippingSaved={(updated) =>
                            handleShippingSaved(row.cell!.productListingId, updated)
                          }
                        />
                      )}
                    </td>
                  </tr>
                  {isAdmin && row.registered && row.cell && (
                    <DisplayNameRow
                      listingId={row.cell.productListingId}
                      name={row.cell.name}
                      registrationName={row.cell.registrationName}
                      tags={generated[row.cell.productListingId]?.tags ?? []}
                      onSaved={load}
                    />
                  )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      <p className="text-[11px] text-amber-700">
        {`${MARKET_OPTION_LOCK_REASON} 옵션 추가는 언제든 가능합니다.`}
      </p>

      <ChannelPreviewModal data={preview} onClose={() => setPreview(null)} />
    </PageContainer>
  );
}
