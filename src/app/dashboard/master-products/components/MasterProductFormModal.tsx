'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Spinner } from '@/presentation/components/Spinner';
import { TagChipsInput } from '@/presentation/components/TagChipsInput';
import { getImageUrl } from '@/infrastructure/utils/imageUrl';
import type { MasterProductUseCase } from '@/application/usecases/MasterProductUseCase';
import type { GetProductsUseCase } from '@/application/usecases/GetProductsUseCase';
import type { CarrierRateUseCase } from '@/application/usecases/CarrierRateUseCase';
import type { PackageUseCase } from '@/application/usecases/PackageUseCase';
import type { ThumbnailTemplateUseCase } from '@/application/usecases/ThumbnailTemplateUseCase';
import type { DetailContentUseCase } from '@/application/usecases/DetailContentUseCase';
import type { ProductImageUseCase } from '@/application/usecases/ProductImageUseCase';
import type { CategoryUseCase } from '@/application/usecases/CategoryUseCase';
import type {
  MasterProductResponse,
  MasterOptionRequest,
  MasterComponent,
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
  type ImageFieldGroup,
  type MasterImageBuffer,
} from './MasterImagePool';

const formatWon = (v: number | null | undefined) =>
  v == null ? '—' : `${v.toLocaleString('ko-KR')}원`;

interface MasterProductFormModalProps {
  master: MasterProductResponse | null; // null = create mode
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
 * 판매상품 마스터 생성/수정 모달.
 * File: src/app/dashboard/master-products/components/MasterProductFormModal.tsx
 * 옵션 편집(MasterOptionEditor)은 수정 모드(=마스터 id 존재)에서만 노출.
 */
export function MasterProductFormModal({
  master: initialMaster,
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
  const [master, setMaster] = useState<MasterProductResponse | null>(initialMaster);
  const isEdit = master != null;

  const [name, setName] = useState(initialMaster?.name ?? '');
  const [selectedIds, setSelectedIds] = useState<number[]>(
    initialMaster?.components.map((c) => c.productId) ?? []
  );
  const [active, setActive] = useState(initialMaster?.active ?? true);

  // Create mode: options are entered in the wizard and created atomically with the master.
  const [options, setOptions] = useState<MasterOptionRequest[]>([]);

  // Create mode: a leaf standard category must be picked (miller-columns drilldown) before
  // save (assigned via setCategory right after create). Edit mode uses MasterCategoryPanel.
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | ''>('');
  const [selectedCategoryName, setSelectedCategoryName] = useState('');
  // Stable browse reference so CategoryTreeColumns' mount effect doesn't re-run every render.
  const browseTree = useCallback(
    (parentId?: number) => categoryUseCase.browseTree(parentId),
    [categoryUseCase],
  );

  // Image fields = cover photo (always first) + the union of detail imageZones across ALL templates
  // (a master's mapped image is reusable by whichever template a channel ends up resolving to).
  const [imageFields, setImageFields] = useState<ImageField[]>([]);
  // Field cards grouped by template (cover photo first), so each zone shows its template membership.
  const [imageFieldGroups, setImageFieldGroups] = useState<ImageFieldGroup[]>([]);
  // Zones the default template requires (create-mode validation only — not the full union above).
  const [requiredZoneKeys, setRequiredZoneKeys] = useState<string[]>([]);

  // Default carrier/box for the price engine (options may override individually).
  const [defaultDeliveryId, setDefaultDeliveryId] = useState<number | ''>(
    initialMaster?.defaultDeliveryId ?? ''
  );
  const [defaultPackageId, setDefaultPackageId] = useState<number | ''>(
    initialMaster?.defaultPackageId ?? ''
  );

  // Create mode only: pool uploads + field mappings buffered here (single source),
  // applied after create() (sequential upload → mapping).
  const [imageBuffer, setImageBuffer] = useState<MasterImageBuffer>({ files: [], assignments: {} });

  const [fields, setFields] = useState<TemplateField[]>([]);
  const [fieldValues, setFieldValues] = useState<Record<string, string>>(
    initialMaster?.fieldValues ?? {}
  );

  // Master tag pool (backend 33). Not part of the create/update DTO, so it is saved
  // via a separate updateTags PATCH after the master exists.
  const [tags, setTags] = useState<string[]>(initialMaster?.tags ?? []);

  const [products, setProducts] = useState<Product[]>([]);
  const [carrierRates, setCarrierRates] = useState<CarrierRate[]>([]);
  const [packages, setPackages] = useState<Package[]>([]);
  const [productFilter, setProductFilter] = useState('');
  const [error, setError] = useState('');
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

  const reloadMaster = useCallback(async () => {
    if (!master) return;
    const fresh = await useCase.getById(master.id);
    setMaster(fresh);
  }, [useCase, master]);

  const toggleProduct = (id: number) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const filteredProducts = useMemo(() => {
    const q = productFilter.trim().toLowerCase();
    if (!q) return products;
    return products.filter((p) => (p.productName ?? '').toLowerCase().includes(q));
  }, [products, productFilter]);

  // Edit mode: the locked BOM as full product rows (thumbnail/name/brand/price).
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

  // Create mode: the option editor renders a quantity row per selected component.
  const createComponents = useMemo<MasterComponent[]>(
    () =>
      selectedIds.map((id) => ({
        productId: id,
        productName: products.find((p) => p.id === id)?.productName ?? `#${id}`,
      })),
    [selectedIds, products],
  );

  // Derive image fields = cover photo (always first) + the union of imageZone binds across ALL
  // detail templates (deduped, first-seen order). Required zones (create validation) stay scoped to
  // the default template. A template load failure yields the cover-photo-only set (non-blocking).
  useEffect(() => {
    let alive = true;
    (async () => {
      let zones: ImageField[] = [];
      let required: string[] = [];
      // Cover photo is a template-independent group, always first.
      const groups: ImageFieldGroup[] = [{ label: '대표사진', keys: [SOURCE_ZONE] }];
      try {
        const templates = await detailUseCase.listTemplates();
        const seen = new Set<string>();
        for (const t of templates) {
          const zoneKeys = (t.blocks ?? [])
            .filter((b) => b.type === 'imageZone' && b.bind)
            .map((b) => b.bind as string);
          if (zoneKeys.length > 0) {
            groups.push({ label: t.name + (t.isDefault ? ' (기본)' : ''), keys: zoneKeys });
          }
          for (const key of zoneKeys) {
            if (!seen.has(key)) {
              seen.add(key);
              zones.push({ key, label: key });
            }
          }
        }
        required = (templates.find((t) => t.isDefault)?.blocks ?? [])
          .filter((b) => b.type === 'imageZone' && b.bind)
          .map((b) => b.bind as string);
      } catch {
        zones = [];
        required = [];
      }
      if (!alive) return;
      setImageFields([{ key: SOURCE_ZONE, label: '대표사진' }, ...zones]);
      setImageFieldGroups(groups);
      setRequiredZoneKeys(required);
    })();
    return () => {
      alive = false;
    };
  }, [detailUseCase]);

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
    if (!isEdit) {
      // A leaf standard category is mandatory in create mode (front-end gate; no API call).
      if (selectedCategoryId === '') {
        setError('세부 카테고리를 선택하세요.');
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
    }
    setIsSubmitting(true);
    // Omit blank values so the backend falls back to product/template defaults.
    const cleaned: Record<string, string> = {};
    for (const [k, v] of Object.entries(fieldValues)) {
      if (v.trim() !== '') cleaned[k] = v;
    }
    try {
      if (!isEdit) {
        // Create the master first to obtain an id, then upload the image override.
        const created = await useCase.create({
          name: name.trim(),
          componentProductIds: selectedIds,
          fieldValues: Object.keys(cleaned).length ? cleaned : undefined,
          defaultDeliveryId: defaultDeliveryId === '' ? undefined : Number(defaultDeliveryId),
          defaultPackageId: defaultPackageId === '' ? undefined : Number(defaultPackageId),
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
      } else {
        await useCase.update(master!.id, {
          name: name.trim(),
          componentProductIds: selectedIds,
          active,
          // Always send the (possibly empty) map: backend treats non-null as a full
          // replace, so cleared fields are reflected; null would keep the old values.
          fieldValues: cleaned,
          defaultDeliveryId: defaultDeliveryId === '' ? undefined : Number(defaultDeliveryId),
          defaultPackageId: defaultPackageId === '' ? undefined : Number(defaultPackageId),
        });
        // Always send tags on edit so clearing to an empty list is honored.
        await useCase.updateTags(master!.id, { tags });
        // Cover photo + zone images commit immediately via MasterImagePool (no work here).
        await onDataChanged();
        onClose();
      }
    } catch (e: unknown) {
      const status = (e as { response?: { status?: number } })?.response?.status;
      setError(status === 400 ? '입력값을 확인하세요.' : '저장에 실패했습니다.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4">
      <div className="my-8 w-full max-w-2xl rounded-lg bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">
            {isEdit ? '마스터 수정' : '새 마스터'}
          </h2>
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
            <label className="mb-1 block text-xs font-medium text-gray-600">이름 *</label>
            <input
              className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm text-gray-900"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">
              구성상품 세트 ({selectedIds.length}개 선택)
            </label>
            {isEdit ? (
              // Composition is locked after creation: show the current set read-only
              // (no search, no add/remove) so the BOM stays fixed.
              <>
                <div className="max-h-64 overflow-y-auto rounded border border-gray-200 bg-gray-50">
                  {selectedProducts.length === 0 ? (
                    <p className="px-3 py-2 text-sm text-gray-500">구성상품이 없습니다.</p>
                  ) : (
                    <table className="w-full text-sm">
                      <thead className="bg-gray-100 text-xs text-gray-500">
                        <tr>
                          <th className="px-2 py-1.5 text-left font-medium">이미지</th>
                          <th className="px-2 py-1.5 text-left font-medium">제품명</th>
                          <th className="px-2 py-1.5 text-left font-medium">브랜드</th>
                          <th className="px-2 py-1.5 text-right font-medium">가격</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedProducts.map((p) => (
                          <tr
                            key={p.id}
                            className="cursor-pointer border-t border-gray-200 hover:bg-gray-100"
                            onClick={() => setDetailProduct(p)}
                          >
                            <td className="px-2 py-1.5">{renderThumb(p)}</td>
                            <td className="px-2 py-1.5 text-gray-900">{p.productName}</td>
                            <td className="px-2 py-1.5 text-gray-600">{p.brand || '—'}</td>
                            <td className="px-2 py-1.5 text-right text-gray-900">
                              {formatWon(p.price)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
                <p className="mt-1 text-[11px] text-gray-500">
                  생성 후에는 구성상품을 추가하거나 뺄 수 없습니다(고정).
                </p>
              </>
            ) : (
              <>
                <input
                  className="mb-2 w-full rounded border border-gray-300 px-2 py-1.5 text-sm text-gray-900"
                  placeholder="상품명 검색"
                  value={productFilter}
                  onChange={(e) => setProductFilter(e.target.value)}
                />
                <div className="max-h-64 overflow-y-auto rounded border border-gray-200">
                  {filteredProducts.length === 0 ? (
                    <p className="px-3 py-2 text-sm text-gray-500">상품이 없습니다.</p>
                  ) : (
                    <table className="w-full text-sm">
                      <thead className="sticky top-0 bg-gray-100 text-xs text-gray-500">
                        <tr>
                          <th className="w-8 px-2 py-1.5"></th>
                          <th className="px-2 py-1.5 text-left font-medium">이미지</th>
                          <th className="px-2 py-1.5 text-left font-medium">제품명</th>
                          <th className="px-2 py-1.5 text-left font-medium">브랜드</th>
                          <th className="px-2 py-1.5 text-right font-medium">가격</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredProducts.map((p) => (
                          <tr
                            key={p.id}
                            className="cursor-pointer border-t border-gray-100 hover:bg-gray-50"
                            onClick={() => toggleProduct(p.id)}
                          >
                            <td className="px-2 py-1.5">
                              <input
                                type="checkbox"
                                checked={selectedIds.includes(p.id)}
                                onChange={() => toggleProduct(p.id)}
                                onClick={(e) => e.stopPropagation()}
                              />
                            </td>
                            <td className="px-2 py-1.5">{renderThumb(p)}</td>
                            <td className="px-2 py-1.5 text-gray-900">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setDetailProduct(p);
                                }}
                                className="text-left text-blue-600 hover:underline"
                              >
                                {p.productName}
                              </button>
                            </td>
                            <td className="px-2 py-1.5 text-gray-600">{p.brand || '—'}</td>
                            <td className="px-2 py-1.5 text-right text-gray-900">
                              {formatWon(p.price)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
                <p className="mt-1 text-[11px] text-gray-500">
                  제품명을 클릭하면 상세 정보를 볼 수 있습니다.
                </p>
              </>
            )}
          </div>

          {!isEdit && (
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">
                세부 카테고리 *
              </label>
              {selectedCategoryId !== '' ? (
                <p className="mb-2 text-sm text-gray-900">
                  선택된 카테고리: <span className="font-medium">{selectedCategoryName}</span>
                </p>
              ) : (
                <p className="mb-2 text-[11px] text-amber-700">
                  세부(leaf) 카테고리 필수 — 트리에서 선택하세요.
                </p>
              )}
              <CategoryTreeColumns
                browse={browseTree}
                selectedId={selectedCategoryId === '' ? null : selectedCategoryId}
                onSelectLeaf={(leaf) => {
                  setSelectedCategoryId(leaf.id);
                  setSelectedCategoryName(leaf.name);
                }}
              />
              <p className="mt-1 text-[11px] text-gray-500">
                카테고리가 없으면{' '}
                <a
                  href={ROUTES.COSTS_CATEGORY}
                  className="text-blue-600 hover:underline"
                >
                  카테고리 관리
                </a>
                에서 import·추가하세요.
              </p>
            </div>
          )}

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
              마켓 전송 시 채널 태그와 결합됩니다(백엔드 처리). Enter 또는 콤마로 추가하세요.
            </p>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">
              이미지 (대표사진 + 상세페이지)
            </label>
            <MasterImagePool
              masterId={master?.id ?? null}
              detailUseCase={detailUseCase}
              fields={imageFields}
              fieldGroups={imageFieldGroups}
              buffer={isEdit ? undefined : imageBuffer}
              onBufferChange={isEdit ? undefined : setImageBuffer}
              productImageUseCase={productImageUseCase}
              sourceProducts={sourceProducts}
            />
            <p className="mt-1 text-[11px] text-gray-500">
              업로드는 풀에 먼저 쌓이고, 풀 이미지를 필드로 드래그하거나 [선택]으로 매핑합니다. 한
              이미지를 대표사진·여러 zone 에 재사용할 수 있습니다.
              {isEdit ? ' 수정 모드에서는 매핑이 즉시 저장됩니다.' : ' 생성 시 저장 후 반영됩니다.'}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">기본 택배비</label>
              <select
                className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm text-gray-900"
                value={defaultDeliveryId}
                onChange={(e) => setDefaultDeliveryId(e.target.value ? Number(e.target.value) : '')}
              >
                <option value="">선택 안 함</option>
                {carrierRates.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.carrier} {r.type} · {formatWon(r.cost)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">기본 상자비</label>
              <select
                className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm text-gray-900"
                value={defaultPackageId}
                onChange={(e) => setDefaultPackageId(e.target.value ? Number(e.target.value) : '')}
              >
                <option value="">선택 안 함</option>
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

          {isEdit && (
            <label className="flex items-center gap-2 text-sm text-gray-900">
              <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
              활성 (active)
            </label>
          )}
        </div>

        <div className="mt-6 flex gap-2">
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {isSubmitting ? <Spinner label="저장 중..." /> : '저장'}
          </button>
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 disabled:opacity-50"
          >
            닫기
          </button>
        </div>

        <div className="mt-6 border-t border-gray-200 pt-6">
          {isEdit && master ? (
            <MasterOptionEditor
              master={master}
              useCase={useCase}
              carrierRates={carrierRates}
              packages={packages}
              masterDefaults={masterDefaults}
              onChanged={async () => {
                await reloadMaster();
                await onDataChanged();
              }}
            />
          ) : (
            <MasterOptionEditor
              components={createComponents}
              options={options}
              onOptionsChange={setOptions}
              carrierRates={carrierRates}
              packages={packages}
              masterDefaults={masterDefaults}
            />
          )}
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
                {detailProduct.unit && (
                  <div className="flex justify-between gap-2">
                    <dt className="text-gray-500">단위</dt>
                    <dd className="text-right text-gray-900">{detailProduct.unit}</dd>
                  </div>
                )}
                {detailProduct.weight && (
                  <div className="flex justify-between gap-2">
                    <dt className="text-gray-500">무게</dt>
                    <dd className="text-right text-gray-900">{detailProduct.weight}</dd>
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
    </div>
  );
}
