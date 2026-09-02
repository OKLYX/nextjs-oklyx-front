'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Spinner } from '@/presentation/components/Spinner';
import { extractErrorMessage } from '@/infrastructure/utils/errorMessage';
import { TagChipsInput } from '@/presentation/components/TagChipsInput';
import { PopupDialogModal } from '@/presentation/components/PopupDialogModal';
import { getImageUrl } from '@/infrastructure/utils/imageUrl';
import { ShippingOverrideFields } from '@/presentation/components/ShippingOverrideFields';
import {
  EMPTY_SHIPPING_OVERRIDE,
  overrideToMap,
  type ShippingOverride,
} from '@/domain/entities/ShippingEntity';
import type { MasterProductUseCase } from '@/application/usecases/MasterProductUseCase';
import type { GetProductsUseCase } from '@/application/usecases/GetProductsUseCase';
import type { CarrierRateUseCase } from '@/application/usecases/CarrierRateUseCase';
import type { PackageUseCase } from '@/application/usecases/PackageUseCase';
import type { ThumbnailTemplateUseCase } from '@/application/usecases/ThumbnailTemplateUseCase';
import type { DetailContentUseCase } from '@/application/usecases/DetailContentUseCase';
import type { ProductImageUseCase } from '@/application/usecases/ProductImageUseCase';
import type { CategoryUseCase } from '@/application/usecases/CategoryUseCase';
import type { Category } from '@/domain/entities/CategoryEntity';
import type {
  MasterOptionRequest,
  MasterComponent,
  CategoryAttribute,
  CategoryNotice,
} from '@/domain/entities/MasterProductEntity';
import type { Product } from '@/domain/entities/Product';
import type { CarrierRate } from '@/domain/entities/CarrierRateEntity';
import type { Package } from '@/domain/entities/PackageEntity';
import { BUILTIN_FIELD_KEYS, type TemplateField } from '@/domain/entities/ThumbnailEntity';
import { SOURCE_ZONE } from '@/domain/entities/DetailTemplateEntity';
import { CategoryTreeColumns } from '@/presentation/components/CategoryTreeColumns';
import { ROUTES } from '@/config/routes';
import { MasterOptionEditor } from './MasterOptionEditor';
import {
  MasterImagePool,
  type ImageField,
  type ImageFieldFilter,
  type MasterImageBuffer,
} from './MasterImagePool';
import { deriveMasterImageFields } from './masterImageFields';
import { DetailImageGroupUseCase } from '@/application/usecases/DetailImageGroupUseCase';
import { DetailImageGroupRepositoryImpl } from '@/infrastructure/repositories/DetailImageGroupRepositoryImpl';
import { MetaPlatformTabs } from '../[id]/components/MetaPlatformTabs';
import {
  CategoryMetaCreateFields,
  EMPTY_META_VALUE,
  type CategoryMetaCreateValue,
} from '../[id]/components/CategoryMetaCreateFields';
import {
  computeMissingRequired,
  noticesToSubmit,
  submitNoticeGroup,
} from '../[id]/components/categoryMetaValidation';

// Per-platform create-mode meta: user values + the loaded schema (for the submit gate).
type MetaEntry = { attributes: CategoryAttribute[]; notices: CategoryNotice[] } & CategoryMetaCreateValue;
const EMPTY_META_ENTRY: MetaEntry = { attributes: [], notices: [], ...EMPTY_META_VALUE };

const formatWon = (v: number | null | undefined) =>
  v == null ? '—' : `${v.toLocaleString('ko-KR')}원`;

// Cap category name-search results (client filter over the full list) — bounds the render.
const CATEGORY_SEARCH_LIMIT = 50;

interface MasterProductFormModalProps {
  useCase: MasterProductUseCase;
  productsUseCase: GetProductsUseCase;
  carrierRateUseCase: CarrierRateUseCase;
  packageUseCase: PackageUseCase;
  thumbnailTemplateUseCase: ThumbnailTemplateUseCase;
  detailUseCase: DetailContentUseCase;
  productImageUseCase: ProductImageUseCase;
  // Create-mode standard-category step: miller-columns tree drilldown (browseTree).
  categoryUseCase: CategoryUseCase;
  onClose: () => void;
  onDataChanged: () => Promise<void> | void; // reload parent list
}

/**
 * 판매상품 마스터 **생성 전용** 마법사 모달 (83B).
 * File: src/app/dashboard/master-products/components/MasterProductFormModal.tsx
 *
 * ⚠️ **수정은 이 모달이 하지 않는다** — 이름·구성상품·카테고리·필수속성·필드값·태그·기본 택배/상자·
 * 옵션·이미지·배송 설정 전부 **마스터 상세 페이지의 토글 섹션**에서 수정한다(편집 지점 단일화, 83A/83B).
 * 여기에 수정 분기를 다시 추가하지 말 것 — 같은 값을 두 곳에서 편집하게 된다.
 *
 * 생성은 한 화면에서 끝난다(단일 마법사): create 로 마스터+옵션을 원자 생성한 뒤 카테고리 지정 →
 * 카테고리 메타 → 배송 설정 → 태그 → 이미지 풀 업로드·매핑을 순차 적용한다(각 단계 실패는 graceful
 * 배너, 롤백 없음 — 마스터는 이미 존재하므로 상세에서 이어서 채운다).
 */
export function MasterProductFormModal({
  useCase,
  productsUseCase,
  carrierRateUseCase,
  packageUseCase,
  thumbnailTemplateUseCase,
  detailUseCase,
  productImageUseCase,
  categoryUseCase,
  onClose,
  onDataChanged,
}: MasterProductFormModalProps) {
  // 이미지 그룹 카탈로그(공용 목록)는 이 모달이 직접 만든다 — 부모 props 계약을 넓히지 않는다.
  const groupUseCase = useMemo(
    () => new DetailImageGroupUseCase(new DetailImageGroupRepositoryImpl()),
    [],
  );
  const [name, setName] = useState('');
  const [selectedIds, setSelectedIds] = useState<number[]>([]);

  // 혼합구성 판정 = 구성품 종수 ≥ 2 (백엔드 63 미러, 중립 도메인 사실).
  const isBundle = selectedIds.length >= 2;
  // 표시/필수 = 선택 플랫폼 요구 union. 오늘 쿠팡 단일 → coupangSelected=true.
  // hideCategoryAttrs = "선택된 채널 중 이 필드(카테고리 속성)를 요구하는 채널이 없다".
  // TODO: 플랫폼 선택 모델 도입 시 실제 선택값으로 교체 (out of scope) — 네이버 추가 시 union 확장.
  const coupangSelected = true;
  const hideCategoryAttrs = coupangSelected && isBundle;

  // Create mode: options are entered in the wizard and created atomically with the master.
  const [options, setOptions] = useState<MasterOptionRequest[]>([]);
  // Confirm dialog (replaces window.confirm): the pending action runs on confirm.
  const [confirmDialog, setConfirmDialog] = useState<{ message: string; onConfirm: () => void } | null>(null);
  // True while the option add/edit form is open → component selection is locked.
  const [optionFormOpen, setOptionFormOpen] = useState(false);

  // Create mode: a leaf standard category must be picked (miller-columns drilldown) before
  // save (assigned via setCategory right after create). Edit mode uses MasterCategoryPanel.
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | ''>('');
  const [selectedCategoryName, setSelectedCategoryName] = useState('');
  // Stable browse reference so CategoryTreeColumns' mount effect doesn't re-run every render.
  const browseTree = useCallback(
    (parentId?: number) => categoryUseCase.browseTree(parentId),
    [categoryUseCase],
  );

  // Form-level error banner (declared early so the category-search handlers below can use it).
  const [error, setError] = useState('');

  // Category name search → results list → expand the tree to the picked node (and auto-select
  // when it's a leaf). Full list is fetched once and cached; filtering is client-side.
  const [catSearchInput, setCatSearchInput] = useState('');
  // Each result carries its ancestor breadcrumb (e.g. "스낵/시리얼 > 스낵 > 기타스낵"), built
  // client-side from the cached full list — no extra API calls.
  const [catResults, setCatResults] = useState<{ cat: Category; path: string }[]>([]);
  const [catSearching, setCatSearching] = useState(false);
  const [catHasSearched, setCatHasSearched] = useState(false);
  const [catTotalMatches, setCatTotalMatches] = useState(0);
  const [catExpandChain, setCatExpandChain] = useState<number[] | null>(null);
  // Once applied, the category is frozen (search + tree hidden) until 수정 is pressed.
  const [categoryLocked, setCategoryLocked] = useState(false);
  const allCategoriesRef = useRef<Category[] | null>(null);

  const runCategorySearch = useCallback(
    async (query: string) => {
      setCatSearching(true);
      try {
        if (allCategoriesRef.current == null) {
          allCategoriesRef.current = await categoryUseCase.getCategories();
        }
        const all = allCategoriesRef.current;
        // Build the ancestor breadcrumb from the cached list (climb parentId via an id map).
        const byId = new Map(all.map((c) => [c.id, c]));
        const pathOf = (c: Category): string => {
          const names: string[] = [];
          let cur: Category | undefined = c;
          let guard = 0;
          while (cur && guard < 20) {
            names.unshift(cur.name);
            cur = cur.parentId != null ? byId.get(cur.parentId) : undefined;
            guard += 1;
          }
          return names.join(' > ');
        };
        const lower = query.trim().toLowerCase();
        const filtered = all.filter((c) => c.name.toLowerCase().includes(lower));
        setCatResults(filtered.slice(0, CATEGORY_SEARCH_LIMIT).map((c) => ({ cat: c, path: pathOf(c) })));
        setCatTotalMatches(filtered.length);
        setCatHasSearched(true);
      } catch (e) {
        setError(extractErrorMessage(e, '카테고리 검색에 실패했습니다.'));
        setCatResults([]);
        setCatTotalMatches(0);
      } finally {
        setCatSearching(false);
      }
    },
    [categoryUseCase],
  );

  const handleCategorySearch = () => {
    if (!catSearchInput.trim()) return;
    void runCategorySearch(catSearchInput);
  };

  // Climb parentId to build the root→…→target ancestor id chain (drives the tree's expandTo).
  const buildCategoryChain = useCallback(
    async (cat: Category): Promise<number[]> => {
      const ids = [cat.id];
      let pid = cat.parentId ?? null;
      let guard = 0;
      while (pid != null && guard < 20) {
        ids.unshift(pid);
        const parent = await categoryUseCase.getCategoryById(pid);
        pid = parent.parentId ?? null;
        guard += 1;
      }
      return ids;
    },
    [categoryUseCase],
  );

  // Select a category; in create mode a change discards existing options (they are built for a
  // specific component+category context).
  const chooseCategory = useCallback(
    (id: number, name: string) => {
      const doSelect = () => {
        setSelectedCategoryId(id);
        setSelectedCategoryName(name);
      };
      if (selectedCategoryId !== id && options.length > 0) {
        setConfirmDialog({
          message: '카테고리를 변경할 경우 기존에 추가한 옵션을 제거됩니다. 계속하시겠습니까?',
          onConfirm: () => {
            setOptions([]);
            doSelect();
          },
        });
        return;
      }
      doSelect();
    },
    [selectedCategoryId, options],
  );

  // Apply the picked category: clear the search UI and freeze the section (수정 to reopen).
  const applyCategory = () => {
    setCatSearchInput('');
    setCatResults([]);
    setCatHasSearched(false);
    setCatTotalMatches(0);
    setCategoryLocked(true);
  };

  // Unlock the category for editing; if options exist, confirm they will be discarded.
  const editCategory = () => {
    if (options.length > 0) {
      setConfirmDialog({
        message: '카테고리를 수정할 경우 기존에 추가한 옵션을 제거됩니다. 계속하시겠습니까?',
        onConfirm: () => {
          setOptions([]);
          setCategoryLocked(false);
        },
      });
      return;
    }
    setCategoryLocked(false);
  };

  // Re-expand the tree to the currently selected category (after browsing elsewhere).
  const revealSelectedCategory = useCallback(async () => {
    if (selectedCategoryId === '') return;
    try {
      const cat = await categoryUseCase.getCategoryById(Number(selectedCategoryId));
      setCatExpandChain(await buildCategoryChain(cat));
    } catch (e) {
      setError(extractErrorMessage(e, '카테고리를 여는 데 실패했습니다.'));
    }
  }, [selectedCategoryId, categoryUseCase, buildCategoryChain]);

  // Pick a search result: expand the tree to it; if it's a leaf, select it directly.
  const handleSelectCategoryResult = useCallback(
    async (cat: Category) => {
      try {
        setCatExpandChain(await buildCategoryChain(cat));
        const siblings = await browseTree(cat.parentId ?? undefined);
        if (siblings.find((n) => n.id === cat.id)?.leaf) {
          chooseCategory(cat.id, cat.name);
        }
      } catch (e) {
        setError(extractErrorMessage(e, '카테고리를 여는 데 실패했습니다.'));
      }
    },
    [buildCategoryChain, browseTree, chooseCategory],
  );

  // Create mode: per-platform category required-attributes/notices (58). Values + loaded
  // schema are buffered here; saved (COUPANG only) after create via setCategoryAttributes.
  const [metaByPlatform, setMetaByPlatform] = useState<Record<string, MetaEntry>>({});
  // 옵션 고시 노출·검증 범위 = 마스터가 전송할 품목군과 같은 값(submitNoticeGroup 단일 해석).
  const coupangMetaEntry = metaByPlatform['COUPANG'];
  const masterNoticeGroup = coupangMetaEntry
    ? submitNoticeGroup(
        coupangMetaEntry.notices,
        coupangMetaEntry.noticeValues,
        coupangMetaEntry.noticeGroup ?? null,
      )
    : null;
  const handleMetaChange = useCallback((platform: string, next: CategoryMetaCreateValue) => {
    setMetaByPlatform((prev) => ({ ...prev, [platform]: { ...(prev[platform] ?? EMPTY_META_ENTRY), ...next } }));
  }, []);
  const handleMetaSchemaLoad = useCallback(
    (platform: string, attributes: CategoryAttribute[], notices: CategoryNotice[]) => {
      setMetaByPlatform((prev) => ({
        ...prev,
        [platform]: { ...(prev[platform] ?? EMPTY_META_ENTRY), attributes, notices },
      }));
    },
    [],
  );

  // Image fields = cover photo (always first) + the union of detail imageZones across ALL templates
  // (a master's mapped image is reusable by whichever template a channel ends up resolving to).
  const [imageFields, setImageFields] = useState<ImageField[]>([]);
  // Filter-only grouping (cover photo + per template); the render order is always `imageFields`.
  const [imageFieldFilters, setImageFieldFilters] = useState<ImageFieldFilter[]>([]);
  // Zones the default template requires (create-mode validation only — not the full union above).
  const [requiredZoneKeys, setRequiredZoneKeys] = useState<string[]>([]);

  // Default carrier/box for the price engine (options may override individually). 생성 시 **필수**
  // (83B): 값 없는 마스터가 생기지 않게 하고, 필수라 해제 경로가 없어 PATCH "null=유지" 계약과 정합.
  // 초기값은 아래 후보 로드 IIFE 에서 isDefault 항목으로 프리셀렉트한다.
  const [defaultDeliveryId, setDefaultDeliveryId] = useState<number | ''>('');
  const [defaultPackageId, setDefaultPackageId] = useState<number | ''>('');

  // Create mode only: pool uploads + field mappings buffered here (single source),
  // applied after create() (sequential upload → mapping).
  const [imageBuffer, setImageBuffer] = useState<MasterImageBuffer>({ files: [], assignments: {} });

  const [fields, setFields] = useState<TemplateField[]>([]);
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({});

  // Master tag pool (backend 33). Not part of the create/update DTO, so it is saved
  // via a separate updateTags PATCH after the master exists.
  const [tags, setTags] = useState<string[]>([]);

  // 전 채널 공통 배송 설정(사용자 결정 2026-08-28). 마스터를 만든 뒤 상세로 들어가야만 지정할 수 있던
  // 값을 생성 단계로 끌어올린 것 — 저장 경로는 상세 패널과 같은 updateShippingOverride.
  const [shippingOverride, setShippingOverride] =
    useState<ShippingOverride>(EMPTY_SHIPPING_OVERRIDE);

  const [products, setProducts] = useState<Product[]>([]);
  const [carrierRates, setCarrierRates] = useState<CarrierRate[]>([]);
  const [packages, setPackages] = useState<Package[]>([]);
  const [productFilter, setProductFilter] = useState('');
  // Search-results dropdown open state (closes on outside click, independent of the query text).
  const [showResults, setShowResults] = useState(false);
  // Once applied, the component set is frozen (search + add/remove disabled) until 수정 is pressed.
  const [componentsLocked, setComponentsLocked] = useState(false);
  const searchBoxRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const onDocMouseDown = (e: MouseEvent) => {
      if (searchBoxRef.current && !searchBoxRef.current.contains(e.target as Node)) {
        setShowResults(false);
      }
    };
    document.addEventListener('mousedown', onDocMouseDown);
    return () => document.removeEventListener('mousedown', onDocMouseDown);
  }, []);
  const [isSubmitting, setIsSubmitting] = useState(false);
  // Component-product detail popup (data already loaded — no extra fetch).
  const [detailProduct, setDetailProduct] = useState<Product | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [prod, rates, boxes] = await Promise.all([
          productsUseCase.getProducts({ page: 0, size: 1000 }),
          carrierRateUseCase.getCarrierRates(),
          packageUseCase.getPackages(),
        ]);
        if (!alive) return;
        setProducts(prod.content);
        setCarrierRates(rates);
        setPackages(boxes);
        // 기본 택배/상자 프리셀렉트(83B): isDefault 항목이 있으면 초기 선택값. 없으면 미선택으로 두고
        // 사용자가 고르게 한다(임의로 첫 항목을 고르지 않는다). ⚠️ 별도 useEffect + setState 는
        // react-hooks/set-state-in-effect 위반이라 이 IIFE 안에서 세팅한다.
        setDefaultDeliveryId(rates.find((r) => r.isDefault)?.id ?? '');
        setDefaultPackageId(boxes.find((b) => b.isDefault)?.id ?? '');
      } catch {
        if (alive) setError('구성상품·택배/박스 후보를 불러오지 못했습니다.');
      }
      // Template fields are a secondary input — a load failure must not block the form.
      try {
        const templates = await thumbnailTemplateUseCase.list();
        if (alive) setFields(templates.find((t) => t.isDefault)?.fields ?? []);
      } catch {
        if (alive) setFields([]);
      }
    })();
    return () => {
      alive = false;
    };
  }, [productsUseCase, carrierRateUseCase, packageUseCase, thumbnailTemplateUseCase]);

  // Apply the picked component set: clear the search UI and freeze the section (수정 to reopen).
  const applyComponents = () => {
    setProductFilter('');
    setShowResults(false);
    setComponentsLocked(true);
  };

  // Unlock components for editing; if options exist, confirm they will be discarded.
  const editComponents = () => {
    if (options.length > 0) {
      setConfirmDialog({
        message: '구성상품을 수정할 경우 기존에 추가한 옵션을 제거됩니다. 계속하시겠습니까?',
        onConfirm: () => {
          setOptions([]);
          setComponentsLocked(false);
        },
      });
      return;
    }
    setComponentsLocked(false);
  };

  const toggleProduct = (id: number) => {
    // Locked while an option is being added/edited, or after the set has been applied (수정 to reopen).
    if (optionFormOpen || componentsLocked) return;
    const doToggle = () =>
      setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
    // Editing the component set invalidates existing options → confirm before dropping them.
    if (options.length > 0) {
      setConfirmDialog({
        message: '구성상품을 변경할 경우 기존에 추가한 옵션을 제거됩니다. 계속하시겠습니까?',
        onConfirm: () => {
          setOptions([]);
          doToggle();
        },
      });
      return;
    }
    doToggle();
  };

  const filteredProducts = useMemo(() => {
    const q = productFilter.trim().toLowerCase();
    if (!q) return products;
    return products.filter((p) => (p.productName ?? '').toLowerCase().includes(q));
  }, [products, productFilter]);

  // Search dropdown = matches excluding already-selected items (they show in the list below).
  const PRODUCT_SEARCH_LIMIT = 50;
  const searchMatches = useMemo(() => {
    const selected = new Set(selectedIds);
    return filteredProducts.filter((p) => !selected.has(p.id));
  }, [filteredProducts, selectedIds]);
  const searchResults = searchMatches.slice(0, PRODUCT_SEARCH_LIMIT);

  // The picked component set as full product rows (thumbnail/name/brand/price).
  const selectedProducts = useMemo(
    () =>
      selectedIds
        .map((id) => products.find((p) => p.id === id))
        .filter((p): p is Product => p != null),
    [selectedIds, products],
  );

  const renderThumb = (p: Product) => {
    const src = getImageUrl(p.imageUrl, p.id);
    return src ? (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={src} alt={p.productName} className="h-10 w-10 rounded border border-gray-200 object-cover" />
    ) : (
      <div className="flex h-10 w-10 items-center justify-center rounded border border-gray-200 bg-gray-100 text-[10px] text-gray-400">
        없음
      </div>
    );
  };

  // Master defaults feed the option editor's carrier/box prefill (SSOT = this form's state,
  // so changing a default here updates option prefill live).
  const masterDefaults = useMemo(
    () => ({
      deliveryId: defaultDeliveryId === '' ? undefined : Number(defaultDeliveryId),
      packageId: defaultPackageId === '' ? undefined : Number(defaultPackageId),
    }),
    [defaultDeliveryId, defaultPackageId],
  );

  // 저장 차단 사유(있으면 [저장] disabled + 푸터 인라인 표시). 기본 택배/상자는 생성 시 필수(83B).
  const saveBlockReason =
    options.length === 0
      ? '저장하려면 옵션을 1개 이상 추가하세요.'
      : defaultDeliveryId === '' || defaultPackageId === ''
        ? '기본 택배비와 기본 상자비를 선택하세요.'
        : null;

  // BOM components → { id, name } for the reference-import picker (backend 40).
  // Empty (no components selected) → import button stays hidden (graceful degrade).
  const sourceProducts = useMemo(
    () =>
      selectedIds
        .map((id) => products.find((p) => p.id === id))
        .filter((p): p is Product => p != null)
        .map((p) => ({ id: p.id, name: p.productName })),
    [selectedIds, products],
  );

  // The option editor renders a quantity row per selected component.
  // ⚠️ netContent/netContentUnit 도 함께 실어 보낸다 — 옵션의 `개당 중량/용량` 을 물품에서
  // 도출하는 소스다(101). edit 모드는 백엔드 master.components 가 같은 필드를 채워 내려준다.
  const createComponents = useMemo<MasterComponent[]>(
    () =>
      selectedIds.map((id) => {
        const p = products.find((x) => x.id === id);
        return {
          productId: id,
          productName: p?.productName ?? `#${id}`,
          netContent: p?.netContent ?? null,
          netContentUnit: p?.netContentUnit ?? null,
        };
      }),
    [selectedIds, products],
  );

  // Image fields = cover photo + the shared detail image group catalog. 도출 규칙은 상세
  // 페이지와 공유하는 헬퍼(deriveMasterImageFields)가 소유한다.
  useEffect(() => {
    let alive = true;
    (async () => {
      const derived = await deriveMasterImageFields(detailUseCase, groupUseCase);
      if (!alive) return;
      setImageFields(derived.fields);
      setImageFieldFilters(derived.fieldFilters);
      setRequiredZoneKeys(derived.requiredZoneKeys);
    })();
    return () => {
      alive = false;
    };
  }, [detailUseCase, groupUseCase]);

  const handleSubmit = async () => {
    setError('');
    if (!name.trim()) {
      setError('이름을 입력하세요.');
      return;
    }
    if (selectedIds.length === 0) {
      setError('구성상품을 1개 이상 선택하세요.');
      return;
    }
    // 기본 택배/상자는 생성 시 필수(83B). 아래 [저장] 이 이미 disabled 지만 방어적으로 한 번 더 막는다.
    if (defaultDeliveryId === '' || defaultPackageId === '') {
      setError('기본 택배비와 기본 상자비를 선택하세요.');
      return;
    }
    // A leaf standard category is mandatory (front-end gate; no API call).
    if (selectedCategoryId === '') {
      setError('세부 카테고리를 선택하세요.');
      return;
    }
    // Required category attributes/notices for COUPANG (other platforms are not saved on create).
    const coupangMeta = metaByPlatform['COUPANG'];
    if (
      computeMissingRequired(
        coupangMeta?.attributes ?? [],
        coupangMeta?.attrValues ?? {},
        coupangMeta?.notices ?? [],
        coupangMeta?.noticeValues ?? {},
        hideCategoryAttrs,
        coupangMeta?.noticeGroup ?? null,
      )
    ) {
      setError('필수 카테고리 속성을 입력하세요.');
      return;
    }
    // Options are created atomically with the master → at least one, each with a name + items.
    if (options.length === 0) {
      setError('옵션을 1개 이상 추가하세요.');
      return;
    }
    for (const opt of options) {
      if (!opt.name.trim()) {
        setError('옵션 이름을 입력하세요.');
        return;
      }
      if (opt.items.length === 0) {
        setError('각 옵션에 구성상품 수량을 입력하세요.');
        return;
      }
    }
    // Only the default template's zones are required; other templates' zones are optional.
    // A zone is satisfied by uploaded files OR mapped product-image references.
    for (const zoneKey of requiredZoneKeys) {
      const fileCount = imageBuffer.assignments[zoneKey]?.length ?? 0;
      const productCount = imageBuffer.productAssignments?.[zoneKey]?.length ?? 0;
      if (fileCount + productCount < 1) {
        setError(`상세 이미지(${zoneKey})를 1장 이상 매핑하세요.`);
        return;
      }
    }
    setIsSubmitting(true);
    // Omit blank values so the backend falls back to product/template defaults.
    const cleaned: Record<string, string> = {};
    for (const [k, v] of Object.entries(fieldValues)) {
      if (v.trim() !== '') cleaned[k] = v;
    }
    try {
      // Create the master first to obtain an id, then upload the image override.
      const created = await useCase.create({
        name: name.trim(),
        componentProductIds: selectedIds,
        fieldValues: Object.keys(cleaned).length ? cleaned : undefined,
        defaultDeliveryId: Number(defaultDeliveryId),
        defaultPackageId: Number(defaultPackageId),
        options,
      });
      // Assign the picked standard category right after create (validation guarantees a value).
      // Graceful: the master already exists → a failure surfaces a distinct banner, no rollback.
      try {
        await useCase.setCategory(created.id, { categoryId: Number(selectedCategoryId) });
      } catch {
        setError('마스터는 생성되었습니다. 카테고리 지정에 실패했습니다(상세에서 재지정).');
        await onDataChanged();
        setIsSubmitting(false);
        return;
      }
      // Category required-attributes/notices (COUPANG values only; other platforms are follow-up).
      const coupangMeta = metaByPlatform['COUPANG'];
      if (coupangMeta) {
        try {
          // 상세 패널과 같은 규칙: 실효 그룹을 한 번 계산해 전송값·전송 그룹이 같은 값에서 나오게 한다.
          const group = submitNoticeGroup(
            coupangMeta.notices,
            coupangMeta.noticeValues,
            coupangMeta.noticeGroup ?? null,
          );
          await useCase.setCategoryAttributes(created.id, {
            attributes: coupangMeta.attrValues,
            // Send only the selected 품목군's notices (user picks one group).
            notices: noticesToSubmit(coupangMeta.notices, coupangMeta.noticeValues, group),
            noticeGroup: group,
          });
        } catch {
          setError('마스터는 생성되었습니다. 카테고리 속성 저장에 실패했습니다(상세에서 재입력).');
          await onDataChanged();
          setIsSubmitting(false);
          return;
        }
      }
      // 전 채널 공통 배송 설정 — 상세 패널과 같은 PATCH. Graceful: 마스터는 이미 생성됨.
      const shippingMap = overrideToMap(shippingOverride);
      if (Object.keys(shippingMap).length > 0) {
        try {
          await useCase.updateShippingOverride(created.id, { override: shippingMap });
        } catch {
          setError('마스터는 생성되었습니다. 배송 설정 저장에 실패했습니다(상세에서 재지정).');
          await onDataChanged();
          setIsSubmitting(false);
          return;
        }
      }
      if (tags.length > 0) await useCase.updateTags(created.id, { tags });
      // Buffer: upload pool files sequentially (index → real id) then apply mappings.
      // Sequential await preserves pool sortOrder (backend = upload order); Promise.all
      // would race it. The master already exists → a failure surfaces a distinct banner.
      try {
        const idByIndex: number[] = [];
        for (const file of imageBuffer.files) {
          const uploaded = await detailUseCase.uploadPoolImage(created.id, file);
          idByIndex.push(uploaded.id);
        }
        // Import product-image references (create pool entries) → map productImageId to pool id.
        const poolIdByProductId = new Map<number, number>();
        const productIds = [
          ...new Set(Object.values(imageBuffer.productAssignments ?? {}).flat()),
        ];
        if (productIds.length > 0) {
          const refs = await detailUseCase.importProductImages(created.id, productIds);
          for (const r of refs) {
            if (r.productImageId != null) poolIdByProductId.set(r.productImageId, r.id);
          }
        }
        // Apply each field = uploaded file pool ids + imported product pool ids.
        const fieldKeys = new Set([
          ...Object.keys(imageBuffer.assignments),
          ...Object.keys(imageBuffer.productAssignments ?? {}),
        ]);
        for (const fieldKey of fieldKeys) {
          const fileIds = (imageBuffer.assignments[fieldKey] ?? [])
            .map((i) => idByIndex[i])
            .filter((v): v is number => v != null);
          const productPoolIds = (imageBuffer.productAssignments?.[fieldKey] ?? [])
            .map((id) => poolIdByProductId.get(id))
            .filter((v): v is number => v != null);
          const ids = [...fileIds, ...productPoolIds];
          if (fieldKey === SOURCE_ZONE) {
            await detailUseCase.setSourceImage(created.id, ids[0] ?? null);
          } else {
            await detailUseCase.setZoneImages(created.id, fieldKey, ids);
          }
        }
      } catch {
        setError('마스터·옵션은 생성되었습니다. 이미지 일부 업로드/매핑에 실패했습니다.');
        await onDataChanged();
        setIsSubmitting(false);
        return;
      }
      await onDataChanged();
      onClose();
    } catch (e: unknown) {
      const status = (e as { response?: { status?: number } })?.response?.status;
      setError(status === 400 ? '입력값을 확인하세요.' : '저장에 실패했습니다.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4">
      <div className="my-8 w-full max-w-4xl rounded-lg bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">마스터 추가</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
          >
            ✕
          </button>
        </div>

        {error && <p className="mb-4 rounded bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">마스터 이름 *</label>
            <input
              className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm text-gray-900"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">
              구성상품 ({selectedIds.length}개 선택)
            </label>
            {/* 검색 = 드롭다운으로 결과 표시(클릭 시 선택 토글). 아래 목록엔 선택된 것만. */}
            <div className="mb-2 flex gap-2" ref={searchBoxRef}>
              <div className="relative flex-1">
                <input
                  className="w-full rounded border border-gray-300 py-1.5 pl-2 pr-8 text-sm text-gray-900 disabled:cursor-not-allowed disabled:bg-gray-100"
                  placeholder="상품명 검색"
                  value={productFilter}
                  disabled={optionFormOpen || componentsLocked}
                  onChange={(e) => {
                    setProductFilter(e.target.value);
                    setShowResults(true);
                  }}
                  onFocus={() => setShowResults(true)}
                  onKeyDown={(e) => e.key === 'Escape' && setShowResults(false)}
                />
                {productFilter !== '' && (
                  <button
                    type="button"
                    onClick={() => {
                      setProductFilter('');
                      setShowResults(false);
                    }}
                    aria-label="검색어 지우기"
                    className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded p-0.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                  >
                    ✕
                  </button>
                )}
                {!componentsLocked && showResults && productFilter.trim() !== '' && (
                  <div className="absolute left-0 right-0 top-full z-20 mt-1 max-h-64 overflow-y-auto rounded border border-gray-200 bg-white shadow-lg">
                    {searchResults.length === 0 ? (
                      <p className="px-3 py-2 text-sm text-gray-500">검색 결과가 없습니다.</p>
                    ) : (
                      <ul>
                        {searchResults.map((p) => (
                          <li
                            key={p.id}
                            className="flex items-center gap-2 border-t border-gray-100 px-2 py-1.5 first:border-t-0 hover:bg-gray-50"
                          >
                            {renderThumb(p)}
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-sm text-gray-900">{p.productName}</span>
                              <span className="block truncate text-[11px] text-gray-400">
                                {p.brand || '—'} · {formatWon(p.price)}
                              </span>
                            </span>
                            <button
                              type="button"
                              onClick={() => toggleProduct(p.id)}
                              disabled={optionFormOpen || componentsLocked}
                              className="shrink-0 rounded border border-blue-300 px-2 py-0.5 text-xs font-medium text-blue-600 hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              추가
                            </button>
                          </li>
                        ))}
                        {searchMatches.length > searchResults.length && (
                          <li className="border-t border-gray-100 px-3 py-1.5 text-[11px] text-gray-400">
                            {searchMatches.length}개 중 {searchResults.length}개 표시 — 더 구체적으로 검색하세요.
                          </li>
                        )}
                      </ul>
                    )}
                  </div>
                )}
              </div>
              <button
                type="button"
                onClick={() => setShowResults(true)}
                disabled={optionFormOpen || componentsLocked || productFilter.trim() === ''}
                className="rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              >
                검색
              </button>
              {componentsLocked ? (
                <button
                  type="button"
                  onClick={editComponents}
                  className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-100"
                >
                  수정
                </button>
              ) : (
                <button
                  type="button"
                  onClick={applyComponents}
                  disabled={optionFormOpen || selectedIds.length === 0}
                  className="rounded-lg bg-green-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
                >
                  설정적용
                </button>
              )}
            </div>

            <p className="mb-1 text-[11px] text-gray-500">
              검색 결과에서 선택하면 아래 목록에 추가됩니다. 제품명을 클릭하면 상세 정보를 볼 수 있습니다.
            </p>
            {optionFormOpen && (
              <p className="mb-1 text-[11px] text-amber-700">
                옵션을 추가하는 동안에는 구성상품을 수정할 수 없습니다. 옵션 편집을 닫은 뒤 수정하세요.
              </p>
            )}
            {!optionFormOpen && options.length > 0 && (
              <p className="mb-1 text-[11px] text-amber-700">
                구성상품을 수정하면 기존에 추가한 옵션이 모두 삭제됩니다.
              </p>
            )}

            {/* 선택된 구성상품만 목록으로. */}
            <div className="max-h-64 overflow-y-auto rounded border border-gray-200">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-gray-100 text-xs text-gray-500">
                  <tr>
                    <th className="px-2 py-1.5 text-left font-medium">이미지</th>
                    <th className="px-2 py-1.5 text-left font-medium">제품명</th>
                    <th className="px-2 py-1.5 text-left font-medium">브랜드</th>
                    <th className="px-2 py-1.5 text-right font-medium">가격</th>
                    <th className="w-10 px-2 py-1.5"></th>
                  </tr>
                </thead>
                <tbody>
                  {selectedProducts.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-3 py-2 text-sm text-gray-500">
                        선택된 상품이 없습니다.
                      </td>
                    </tr>
                  ) : (
                    selectedProducts.map((p) => (
                      <tr key={p.id} className="border-t border-gray-100">
                        <td className="px-2 py-1.5">{renderThumb(p)}</td>
                        <td className="px-2 py-1.5 text-gray-900">
                          <button
                            type="button"
                            onClick={() => setDetailProduct(p)}
                            className="text-left text-blue-600 hover:underline"
                          >
                            {p.productName}
                          </button>
                        </td>
                        <td className="px-2 py-1.5 text-gray-600">{p.brand || '—'}</td>
                        <td className="px-2 py-1.5 text-right text-gray-900">
                          {formatWon(p.price)}
                        </td>
                        <td className="px-2 py-1.5 text-right">
                          <button
                            type="button"
                            onClick={() => toggleProduct(p.id)}
                            disabled={optionFormOpen || componentsLocked}
                            className="rounded px-1.5 py-0.5 text-xs font-medium text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
                            aria-label="구성상품 제거"
                          >
                            ✕
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">
              카테고리 *
            </label>
            {selectedCategoryId !== '' && (
              <p className="mb-2 flex items-center gap-2 text-sm text-gray-900">
                <span>
                  선택된 카테고리: <span className="font-medium">{selectedCategoryName}</span>
                </span>
                <button
                  type="button"
                  onClick={() => void revealSelectedCategory()}
                  className="rounded border border-gray-300 px-2 py-0.5 text-xs font-medium text-gray-700 hover:bg-gray-100"
                >
                  선택 카테고리로 이동
                </button>
              </p>
            )}

            {/* 이름 검색 → 결과 클릭 시 트리를 그 위치로 펼치고(leaf 면 바로 선택). */}
            <div className="mb-2 flex gap-2">
              <input
                className="flex-1 rounded border border-gray-300 px-2 py-1.5 text-sm text-gray-900 disabled:cursor-not-allowed disabled:bg-gray-100"
                placeholder="카테고리 이름으로 검색"
                value={catSearchInput}
                disabled={categoryLocked}
                onChange={(e) => setCatSearchInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleCategorySearch();
                  }
                }}
              />
              <button
                type="button"
                onClick={handleCategorySearch}
                disabled={categoryLocked || catSearching || !catSearchInput.trim()}
                className="rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {catSearching ? <Spinner label="검색 중..." /> : '검색'}
              </button>
              {categoryLocked ? (
                <button
                  type="button"
                  onClick={editCategory}
                  className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-100"
                >
                  수정
                </button>
              ) : (
                <button
                  type="button"
                  onClick={applyCategory}
                  disabled={selectedCategoryId === ''}
                  className="rounded-lg bg-green-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
                >
                  설정적용
                </button>
              )}
            </div>
            {!categoryLocked && catHasSearched && (
              <div className="mb-2 max-h-40 overflow-y-auto rounded border border-gray-200">
                {catResults.length === 0 ? (
                  <p className="px-3 py-2 text-sm text-gray-500">검색 결과가 없습니다.</p>
                ) : (
                  <ul className="divide-y divide-gray-100">
                    {catResults.map((r) => (
                      <li key={r.cat.id}>
                        <button
                          type="button"
                          onClick={() => void handleSelectCategoryResult(r.cat)}
                          title={r.path}
                          className="block w-full px-3 py-1.5 text-left hover:bg-blue-50"
                        >
                          <span className="block text-sm text-gray-800">{r.cat.name}</span>
                          <span className="block break-words text-[11px] text-gray-400">{r.path}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
                {catTotalMatches > catResults.length && (
                  <p className="border-t border-gray-100 px-3 py-1.5 text-[11px] text-gray-400">
                    {catTotalMatches}개 중 {catResults.length}개 표시 — 더 구체적으로 검색하세요.
                  </p>
                )}
              </div>
            )}

            {/* Locked: keep the tree browsable/scrollable but freeze leaf selection (no-op). */}
            <CategoryTreeColumns
              browse={browseTree}
              selectedId={selectedCategoryId === '' ? null : selectedCategoryId}
              expandTo={catExpandChain}
              onSelectLeaf={
                categoryLocked ? () => {} : (leaf) => chooseCategory(leaf.id, leaf.name)
              }
            />
            {!categoryLocked && (
              <p className="mt-1 text-[11px] text-gray-500">
                카테고리가 없으면{' '}
                <a
                  href={ROUTES.COSTS_CATEGORY}
                  className="text-blue-600 hover:underline"
                >
                  카테고리 관리
                </a>
                에서 추가하세요.
              </p>
            )}
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">
              필수속성 / 상품정보제공고시
            </label>
            <MetaPlatformTabs>
              {(platform) => (
                <CategoryMetaCreateFields
                  key={platform}
                  categoryId={selectedCategoryId === '' ? null : selectedCategoryId}
                  platform={platform}
                  value={metaByPlatform[platform] ?? EMPTY_META_VALUE}
                  onChange={(next) => handleMetaChange(platform, next)}
                  onSchemaLoad={(attrs, notices) => handleMetaSchemaLoad(platform, attrs, notices)}
                  hideCategoryAttrs={hideCategoryAttrs}
                />
              )}
            </MetaPlatformTabs>
          </div>

          {fields.length > 0 && (
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">
                템플릿 필드값 (선택)
              </label>
              <div className="grid grid-cols-2 gap-3">
                {fields.map((f) => (
                  <div key={f.key}>
                    <label className="mb-1 block text-xs font-medium text-gray-600">{f.label}</label>
                    <input
                      className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm text-gray-900"
                      value={fieldValues[f.key] ?? ''}
                      placeholder={
                        (BUILTIN_FIELD_KEYS as readonly string[]).includes(f.key)
                          ? '등록상품값 사용'
                          : '템플릿 기본값 사용'
                      }
                      onChange={(e) =>
                        setFieldValues((prev) => ({ ...prev, [f.key]: e.target.value }))
                      }
                    />
                  </div>
                ))}
              </div>
              <p className="mt-1 text-[11px] text-gray-500">
                비우면 예약 필드는 등록상품 정보, 커스텀 필드는 템플릿 기본값으로 채워집니다. 채널마다
                다르게 하려면 등록 후 셀의 [필드값 편집]에서 조정하세요.
              </p>
            </div>
          )}

          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">태그 (선택)</label>
            <TagChipsInput tags={tags} onChange={setTags} disabled={isSubmitting} />
            <p className="mt-1 text-[11px] text-gray-500">
              Enter 또는 콤마로 추가하세요.
            </p>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">
              이미지 (대표사진 + 상세페이지)
            </label>
            <MasterImagePool
              masterId={null}
              detailUseCase={detailUseCase}
              fields={imageFields}
              fieldFilters={imageFieldFilters}
              buffer={imageBuffer}
              onBufferChange={setImageBuffer}
              productImageUseCase={productImageUseCase}
              sourceProducts={sourceProducts}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">기본 택배비 *</label>
              <select
                className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm text-gray-900"
                value={defaultDeliveryId}
                onChange={(e) => setDefaultDeliveryId(e.target.value ? Number(e.target.value) : '')}
              >
                {carrierRates.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.carrier} {r.type} · {formatWon(r.cost)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">기본 상자비 *</label>
              <select
                className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm text-gray-900"
                value={defaultPackageId}
                onChange={(e) => setDefaultPackageId(e.target.value ? Number(e.target.value) : '')}
              >
                {packages.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.type} · {formatWon(p.cost)}
                  </option>
                ))}
              </select>
            </div>
            <p className="col-span-2 text-[11px] text-gray-500">
              옵션에서 개별 지정하지 않으면 이 값이 모든 옵션 판매가 계산에 쓰입니다.
            </p>
          </div>

          <div className="space-y-2 rounded border border-gray-200 p-3">
            <h3 className="text-sm font-semibold text-gray-900">배송 설정 (전 채널 공통)</h3>
            <p className="text-[11px] text-gray-500">
              비우면 판매채널의 기본 배송 설정을 그대로 씁니다. 채워두면 이 마스터의 모든 채널에
              적용되고, 채널마다 다르게 하려면 나중에 [채널 배송 설정]에서 바꿉니다. 출고지·반품지는
              판매채널마다 달라야 해서 여기서 지정하지 않습니다.
            </p>
            <ShippingOverrideFields
              level="master"
              scope="common"
              value={shippingOverride}
              onChange={setShippingOverride}
              platform="COUPANG"
              disabled={isSubmitting}
            />
          </div>
        </div>

        <div className="mt-6 border-t border-gray-200 pt-6">
          <MasterOptionEditor
            components={createComponents}
            options={options}
            onOptionsChange={setOptions}
            carrierRates={carrierRates}
            packages={packages}
            masterDefaults={masterDefaults}
            categoryId={selectedCategoryId === '' ? null : selectedCategoryId}
            masterAttrValues={metaByPlatform['COUPANG']?.attrValues ?? {}}
            masterNoticeValues={metaByPlatform['COUPANG']?.noticeValues ?? {}}
            masterNoticeGroup={masterNoticeGroup}
            hideCategoryAttrs={hideCategoryAttrs}
            onFormOpenChange={setOptionFormOpen}
          />
        </div>

        <div className="mt-6 flex items-center justify-end gap-2 border-t border-gray-200 pt-6">
          {saveBlockReason && (
            <span className="mr-auto text-[11px] text-amber-700">{saveBlockReason}</span>
          )}
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 disabled:opacity-50"
          >
            닫기
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isSubmitting || saveBlockReason != null}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {isSubmitting ? <Spinner label="저장 중..." /> : '저장'}
          </button>
        </div>
      </div>

      {detailProduct && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4"
          onClick={() => setDetailProduct(null)}
        >
          <div
            className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-base font-semibold text-gray-900">상품 상세</h3>
              <button
                type="button"
                onClick={() => setDetailProduct(null)}
                className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
              >
                ✕
              </button>
            </div>
            <div className="flex gap-4">
              <div className="shrink-0">
                {(() => {
                  const src = getImageUrl(detailProduct.imageUrl, detailProduct.id);
                  return src ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={src}
                      alt={detailProduct.productName}
                      className="h-24 w-24 rounded border border-gray-200 object-cover"
                    />
                  ) : (
                    <div className="flex h-24 w-24 items-center justify-center rounded border border-gray-200 bg-gray-100 text-xs text-gray-400">
                      이미지 없음
                    </div>
                  );
                })()}
              </div>
              <dl className="flex-1 space-y-1.5 text-sm">
                <div className="flex justify-between gap-2">
                  <dt className="text-gray-500">제품명</dt>
                  <dd className="text-right text-gray-900">{detailProduct.productName}</dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-gray-500">브랜드</dt>
                  <dd className="text-right text-gray-900">{detailProduct.brand || '—'}</dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-gray-500">가격</dt>
                  <dd className="text-right text-gray-900">{formatWon(detailProduct.price)}</dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-gray-500">스토어</dt>
                  <dd className="text-right text-gray-900">{detailProduct.store || '—'}</dd>
                </div>
                {detailProduct.barcodeId && (
                  <div className="flex justify-between gap-2">
                    <dt className="text-gray-500">바코드</dt>
                    <dd className="text-right text-gray-900">{detailProduct.barcodeId}</dd>
                  </div>
                )}
                {detailProduct.netContentUnit && (
                  <div className="flex justify-between gap-2">
                    <dt className="text-gray-500">단위</dt>
                    <dd className="text-right text-gray-900">{detailProduct.netContentUnit}</dd>
                  </div>
                )}
                {detailProduct.netContent && (
                  <div className="flex justify-between gap-2">
                    <dt className="text-gray-500">내용물 양</dt>
                    <dd className="text-right text-gray-900">{detailProduct.netContent}</dd>
                  </div>
                )}
              </dl>
            </div>
            {detailProduct.description && (
              <div className="mt-4 border-t border-gray-200 pt-3">
                <p className="mb-1 text-xs font-medium text-gray-500">설명</p>
                <p className="whitespace-pre-wrap text-sm text-gray-700">
                  {detailProduct.description}
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      <PopupDialogModal
        isOpen={confirmDialog != null}
        title="옵션 삭제 확인"
        message={confirmDialog?.message ?? ''}
        confirmText="삭제하고 계속"
        cancelText="취소"
        isDangerous
        onConfirm={() => {
          confirmDialog?.onConfirm();
          setConfirmDialog(null);
        }}
        onCancel={() => setConfirmDialog(null)}
      />
    </div>
  );
}
