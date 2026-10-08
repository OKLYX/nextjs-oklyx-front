'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronLeft } from 'lucide-react';
import { Button } from '@/presentation/components/ui/Button';
import { Input } from '@/presentation/components/ui/Input';
import { Spinner } from '@/presentation/components/Spinner';
import { ImageLightbox } from '@/presentation/components/ImageLightbox';
import { CopyIdButton } from '@/app/dashboard/master-products/[id]/components/CopyIdButton';
import { extractErrorMessage } from '@/infrastructure/utils/errorMessage';
import { formatKrw } from '@/infrastructure/utils/money';
import { getProductThumbUrl } from '@/infrastructure/utils/imageUrl';
import { resolveThumbUrl } from '@/infrastructure/utils/thumbUrl';
import { setSmallDragImage } from '@/infrastructure/utils/dragGhost';
import { newClipId } from '@/infrastructure/stores/clipboardStore';
import { CLIP_MIME, type ClipItem } from '@/domain/entities/ClipItem';
import { purchasePlaceNames, type Product } from '@/domain/entities/Product';
import type { ProductImage } from '@/domain/entities/ProductImage';
import { GetProductsUseCase } from '@/application/usecases/GetProductsUseCase';
import { ProductRepositoryImpl } from '@/infrastructure/repositories/ProductRepositoryImpl';
import { ProductImageUseCase } from '@/application/usecases/ProductImageUseCase';
import { ProductImageRepositoryImpl } from '@/infrastructure/repositories/ProductImageRepositoryImpl';

/**
 * One tool in the global tool panel — **「등록 상품 조회」** (FEATURE_2610_08).
 *
 * **Purpose**: find a product registered in oclyx (Product — not a master, not a sales listing) by one
 *   keyword and read its fields and photos next to the open screen, without leaving that screen.
 * **File**: src/app/dashboard/components/RegisteredProductTool.tsx
 * **Wired in**: `toolRegistry.tsx` (the `ToolPanel` body). Screens do not render this component.
 *
 * **Two views, one state**: `selected === null` shows the search view (input + results); a product in
 *   `selected` shows its detail view. [뒤로] returns to the search view with the keyword, the loaded
 *   results and the next page kept. No route, URL or browser history entry is touched.
 *
 * **Usage** (`toolRegistry.tsx`)
 * ```tsx
 * { key: 'registered-product', label: '등록 상품 조회', Icon: PackageSearch, Body: RegisteredProductTool }
 * ```
 *
 * ⚠️ A search goes out on [조회] or Enter; Enter calls `preventDefault` because the panel can sit over a form.
 * ⚠️ Field values come from the search response row (no detail refetch); photos are fetched each time a
 *    detail view opens.
 * ⚠️ A dragged photo carries clip kind `image` — the same payload as the product gallery card.
 * ❌ Do not link to the product detail page, add [채우기], or keep results after the panel closes.
 */

/** Rows per [조회] / [더 보기] call (FEATURE_2610_08 / D12). */
const PAGE_SIZE = 20;

/** One row of the detail view. `shown === null` renders 「(없음)」 with no copy button. */
interface DetailField {
  label: string;
  shown: string | null;
  copied: string | null;
  /** Keeps line breaks (description). */
  multiline?: boolean;
}

/** `null` for a missing or blank value (same rule as the product detail page's missing-field count). */
const filled = (value: string | null | undefined): string | null =>
  value == null || value.trim() === '' ? null : value;

/** Fields in display order (D5 · D15) with what is shown and what is copied (D16). */
function detailFields(product: Product): DetailField[] {
  const text = (label: string, value: string | null | undefined): DetailField => {
    const v = filled(value);
    return { label, shown: v, copied: v };
  };
  return [
    text('상품 ID', String(product.id)),
    text('상품명', product.productName),
    text('바코드 ID', product.barcodeId),
    text('브랜드', product.brand),
    {
      label: '가격',
      shown: product.price == null ? null : formatKrw(product.price),
      copied: product.price == null ? null : String(product.price),
    },
    text('구매처', purchasePlaceNames(product)),
    text('내용물 양', product.netContent),
    text('단위', product.netContentUnit),
    text('개수', product.countQuantity == null ? null : String(product.countQuantity)),
    text('개수 단위', product.countUnit),
    text('높이', product.packageHeight),
    text('길이', product.packageLength),
    text('너비', product.packageWidth),
    { ...text('설명', product.description), multiline: true },
  ];
}

export function RegisteredProductTool() {
  const productsUseCase = useMemo(() => new GetProductsUseCase(new ProductRepositoryImpl()), []);
  const imageUseCase = useMemo(() => new ProductImageUseCase(new ProductImageRepositoryImpl()), []);

  const [query, setQuery] = useState('');
  /** Keyword of the loaded results — [더 보기] pages with this, not with the edited input. */
  const [searchedQuery, setSearchedQuery] = useState('');
  const [results, setResults] = useState<Product[] | null>(null);
  const [nextPage, setNextPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [looking, setLooking] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');

  /** `null` = search view, a product = its detail view (D23). */
  const [selected, setSelected] = useState<Product | null>(null);
  const [images, setImages] = useState<ProductImage[]>([]);
  const [imagesState, setImagesState] = useState<'loading' | 'error' | 'ready'>('loading');
  /** Index of the photo in the lightbox. `null` = closed. */
  const [zoom, setZoom] = useState<number | null>(null);

  /** Result row buttons by product id — the opened row is scrolled back into view after [뒤로]. */
  const rowRefs = useRef(new Map<number, HTMLButtonElement>());
  const lastOpenedId = useRef<number | null>(null);
  const detailTopRef = useRef<HTMLDivElement>(null);
  /** Bumped on each detail open and on [뒤로]; a photo response with an older number is dropped. */
  const imageRequestSeq = useRef(0);

  const trimmed = query.trim();
  const isLookupDisabled = trimmed === '' || looking;

  // D25: entering the detail view shows its top line; returning shows the row that was opened.
  useEffect(() => {
    if (selected) {
      detailTopRef.current?.scrollIntoView({ block: 'start' });
      return;
    }
    if (lastOpenedId.current != null) {
      rowRefs.current.get(lastOpenedId.current)?.scrollIntoView({ block: 'center' });
    }
  }, [selected]);

  const handleLookup = async () => {
    if (isLookupDisabled) return;
    setLooking(true);
    setError('');
    setResults(null);
    try {
      const res = await productsUseCase.getProducts({ page: 0, size: PAGE_SIZE, search: trimmed });
      setResults(res.content);
      setSearchedQuery(trimmed);
      setNextPage(1);
      setHasMore(!res.last);
    } catch (e: unknown) {
      setError(extractErrorMessage(e, '상품을 조회하지 못했습니다.'));
    } finally {
      setLooking(false);
    }
  };

  /** [더 보기] — appends the next page (no infinite scroll). */
  const handleMore = async () => {
    if (!hasMore || loadingMore) return;
    setLoadingMore(true);
    setError('');
    try {
      const res = await productsUseCase.getProducts({
        page: nextPage,
        size: PAGE_SIZE,
        search: searchedQuery,
      });
      // A product registered between two pages shifts the list by one row — skip ids already shown.
      setResults((prev) => {
        const shownIds = new Set((prev ?? []).map((p) => p.id));
        return [...(prev ?? []), ...res.content.filter((p) => !shownIds.has(p.id))];
      });
      setNextPage(nextPage + 1);
      setHasMore(!res.last);
    } catch (e: unknown) {
      setError(extractErrorMessage(e, '상품을 조회하지 못했습니다.'));
    } finally {
      setLoadingMore(false);
    }
  };

  /** Opens the detail view and fetches its photos (D24 — no cache). */
  const openDetail = async (product: Product) => {
    lastOpenedId.current = product.id;
    setSelected(product);
    setZoom(null);
    setImages([]);
    setImagesState('loading');
    imageRequestSeq.current += 1;
    const seq = imageRequestSeq.current;
    try {
      const list = await imageUseCase.list(product.id);
      if (seq !== imageRequestSeq.current) return;
      setImages([...list].sort((a, b) => a.sortOrder - b.sortOrder));
      setImagesState('ready');
    } catch {
      if (seq === imageRequestSeq.current) setImagesState('error');
    }
  };

  /** [뒤로] — keeps keyword, results and next page (D25). */
  const handleBack = () => {
    imageRequestSeq.current += 1;
    setZoom(null);
    setSelected(null);
  };

  /** Drag payload of one photo — clip kind `image`, same shape as the product gallery card (D10). */
  const startImageDrag = (e: React.DragEvent, product: Product, image: ProductImage) => {
    const clip: ClipItem = {
      clipId: newClipId(),
      kind: 'image',
      pickedAt: new Date().toISOString(),
      productId: product.id,
      productName: product.productName,
      productImageId: image.id,
      imageUrl: image.imageUrl,
    };
    e.dataTransfer.setData(CLIP_MIME, JSON.stringify(clip));
    e.dataTransfer.effectAllowed = 'copy';
    setSmallDragImage(e);
  };

  if (selected) {
    return (
      <div className="space-y-4">
        <div ref={detailTopRef} className="flex items-center gap-2">
          <Button
            size="sm"
            variant="secondary"
            className="inline-flex shrink-0 items-center gap-1"
            onClick={handleBack}
          >
            <ChevronLeft size={16} aria-hidden />
            뒤로
          </Button>
          <p className="min-w-0 flex-1 truncate text-sm font-semibold text-gray-900">
            {selected.productName}
          </p>
        </div>

        <div className="space-y-3">
          {detailFields(selected).map((field) => (
            <div key={field.label} className="flex items-start gap-2">
              <div className="min-w-0 flex-1">
                <p className="text-[11px] text-gray-500">{field.label}</p>
                <p
                  className={`break-words text-sm text-gray-900${field.multiline ? ' whitespace-pre-wrap' : ''}`}
                >
                  {field.shown ?? <span className="text-gray-400">(없음)</span>}
                </p>
              </div>
              {field.copied != null && <CopyIdButton value={field.copied} />}
            </div>
          ))}
        </div>

        <div className="space-y-2">
          <p className="text-xs font-semibold text-gray-900">사진</p>
          {imagesState === 'loading' ? (
            <Spinner label="불러오는 중…" />
          ) : imagesState === 'error' ? (
            <p className="rounded bg-red-50 px-2 py-1.5 text-xs text-red-700">사진을 불러오지 못했습니다.</p>
          ) : images.length === 0 ? (
            <p className="text-xs text-gray-500">사진이 없습니다.</p>
          ) : (
            <div className="grid grid-cols-3 gap-2">
              {images.map((image, index) => (
                <button
                  key={image.id}
                  type="button"
                  draggable
                  onDragStart={(e) => startImageDrag(e, selected, image)}
                  onClick={() => setZoom(index)}
                  className="aspect-square overflow-hidden rounded border border-gray-200 bg-gray-100 hover:border-blue-400"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={resolveThumbUrl(image.imageUrl)}
                    alt="상품 사진"
                    draggable={false}
                    className="h-full w-full object-contain"
                  />
                </button>
              ))}
            </div>
          )}
        </div>

        <ImageLightbox
          images={images.map((image) => ({ url: resolveThumbUrl(image.imageUrl), alt: '상품 사진' }))}
          index={zoom}
          onIndexChange={setZoom}
          onClose={() => setZoom(null)}
        />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <Input
            size="sm"
            aria-label="검색어"
            placeholder="상품명 · 브랜드 · 설명 · 바코드 · 상품 ID"
            value={query}
            disabled={looking}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key !== 'Enter') return;
              e.preventDefault(); // 🔴 Blocks implicit form submit — the panel can sit over a form.
              if (!isLookupDisabled) void handleLookup();
            }}
          />
        </div>
        <Button type="button" size="sm" disabled={isLookupDisabled} onClick={() => void handleLookup()}>
          {looking ? <Spinner label="조회 중…" /> : '조회'}
        </Button>
      </div>

      {error && <p className="rounded bg-red-50 px-2 py-1.5 text-xs text-red-700">{error}</p>}

      {results && (
        <div className="space-y-2">
          {results.length === 0 ? (
            <p className="text-xs text-gray-500">조회된 상품이 없습니다.</p>
          ) : (
            <div className="divide-y divide-gray-100 rounded border border-gray-200">
              {results.map((product) => {
                const thumb = getProductThumbUrl(product.imageUrl, product.id);
                return (
                  <button
                    key={product.id}
                    ref={(el) => {
                      if (el) rowRefs.current.set(product.id, el);
                      else rowRefs.current.delete(product.id);
                    }}
                    type="button"
                    onClick={() => void openDetail(product)}
                    className="flex w-full items-center gap-2 px-2 py-1.5 text-left hover:bg-gray-50"
                  >
                    {thumb ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={thumb}
                        alt=""
                        draggable={false}
                        className="h-10 w-10 shrink-0 rounded border border-gray-200 bg-gray-50 object-cover"
                      />
                    ) : (
                      <span className="block h-10 w-10 shrink-0 rounded border border-gray-200 bg-gray-100" />
                    )}
                    <span className="block min-w-0 flex-1">
                      <span className="block truncate text-sm text-gray-900">{product.productName}</span>
                      <span className="block truncate text-[11px] text-gray-500">
                        {filled(product.brand) ?? '브랜드 없음'} · {filled(product.barcodeId) ?? '바코드 없음'}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          )}
          {hasMore && (
            <Button size="sm" variant="secondary" disabled={loadingMore} onClick={() => void handleMore()}>
              {loadingMore ? <Spinner label="불러오는 중…" /> : '더 보기'}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
