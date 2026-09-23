'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import axios from 'axios';
import { resolveThumbUrl } from '@/infrastructure/utils/thumbUrl';
import { Spinner } from '@/presentation/components/Spinner';
import type { ProductImage } from '@/domain/entities/ProductImage';
import type { ProductImageUseCase } from '@/application/usecases/ProductImageUseCase';
import { Card } from '@/presentation/components/ui/Card';
import { CLIP_MIME, clipSourceImageIds, hasClipPayload, type ClipItem } from '@/domain/entities/ClipItem';
import { newClipId } from '@/infrastructure/stores/clipboardStore';
import { ImageLightbox } from '@/presentation/components/ImageLightbox';

/**
 * 물품(상품)의 다중 이미지 갤러리. 단일 `ProductImageSection` 을 대체하며 물품
 * 등록/수정/상세 3화면에서 재사용한다.
 * File: src/app/dashboard/products/[id]/components/ProductImageGallery.tsx
 *
 * **용도**: 여러 장 업로드(버튼 + 드래그앤드롭)·대체·삭제·순서변경(◀▶)·원본 다운로드.
 *   첫 장이 "대표"(백엔드 규칙).
 *   - [다운로드]는 읽기 전용이라 `isViewMode` 에서도 노출한다. 수정/상세 모드는 same-origin
 *     프록시(`/api/image-download?url=…`)를 거친다 — S3 URL 은 교차 출처라 `<a download>` 가
 *     무시되기 때문(등록 모드는 blob: URL 이라 그대로 저장됨).
 *
 * **드래그앤드롭 업로드**: 카드 전체가 드롭존이다(여러 장 동시 가능). [이미지 업로드] 버튼과
 *   **같은 경로**(`ingestFiles`)를 타므로 검증·버퍼/서버 분기가 한 곳에만 있다.
 *   - `onDragOver` 에서 `preventDefault()` 를 빼면 브라우저가 파일을 새 탭으로 열어 버린다.
 *   - 겹침 표시는 **depth 카운터**로 센다 — 자식 카드 위를 지날 때마다 `dragleave` 가 떠서
 *     boolean 하나로는 오버레이가 깜빡인다.
 *   - 오버레이는 `pointer-events-none` 필수. 드롭을 가로채면 업로드가 아예 안 된다.
 *   - 조회 모드(`isViewMode`)·업로드 중(`busy`)에는 받지 않는다.
 *
 * **클립보드(FEATURE_2609_62)**: 카드를 끌어 오른쪽 툴바의 클립보드에 담고(`draggable`), 담아둔 항목을
 *   이 드롭존에 놓아 **참조 복제**로 붙인다(`useCase.copy` — 파일을 다시 올리지 않는다).
 *   - 드롭존은 파일(`Files`)과 클립(`application/x-oklyx-clip`) 두 종류를 구분해 받는다.
 *   - 🔴 카드 안 `<img>` 에 `draggable={false}` 필수 — 없으면 브라우저가 이미지 자체를 끌어
 *     카드의 `dragstart` 가 뜨지 않는다.
 *   - 🔴 담을 때 싣는 `imageUrl` 은 **저장값**(`item.rawUrl` = `img.imageUrl`)이다. 렌더용 `item.url`
 *     (`resolveThumbUrl` 통과값)을 실으면 백엔드가 되받는 값과 달라진다.
 *   - 등록 모드(`productId == null`)는 서버 id 가 없어 **담지도 붙이지도 못한다**(안내 문구).
 *   - 🔴 **자기 갤러리로 되돌아온 드롭은 무시한다**: 카드가 `draggable` 이라 사진을 끌어 스크롤하려다
 *     이 드롭존에 놓으면 "자기 사진을 자기한테 붙여넣기" 가 돼 같은 사진이 한 장 더 생겼다.
 *     `selfDragRef`(카드 `dragstart` 에서 켜고 `dragend` 에서 끈다)로 드롭 자체를 건너뛴다.
 *   - 🔴 두 번째 그물: 클립보드 말풍선에서 끌어온 것이라도 **이미 이 갤러리에 있는 사진**(`imageUrl`
 *     또는 `productImageId` 일치)은 붙이지 않는다 — 한 물품에 같은 사진이 두 장 있을 이유가 없다.
 *
 * **확대 보기**: 카드 사진을 누르면 공용 `ImageLightbox` 로 크게 본다(◀▶ · ← → · ESC · 원본 열기).
 *   조회 모드에서도 열린다(읽기 동작). 자체 확대 팝업을 새로 만들지 말 것.
 *
 * **마켓 사진(FEATURE_2609_68)**: 전역 도구 패널에서 끌어온 사진(`kind: 'market-image'`)은 우리 행이
 *   아니라 **남의 URL** 이라 붙이는 경로가 다르다 — `useCase.addFromUrls(productId, [url])`.
 *   - 🔴 **등록 모드도 이것만은 받는다**: URL 은 저장 뒤에 서버가 내려받으면 되기 때문이다. 부모가 든
 *     URL 대기열(`urlBuffer`)에 쌓이고 **그 자리에 미리보기로 바로 보인다**.
 *   - 🔴 대기열 상한은 **10장**(백엔드 가드가 요청당 10장이고, 한 번에 보내는 곳이 여기뿐이다).
 *   - 🔴 마켓 URL 행에는 [다운로드]·[대체]·◀▶ 를 달지 않는다(교차 출처라 `download` 가 먹지 않고,
 *     순서는 파일 뒤 고정이다).
 *
 * **모드**:
 *   - 수정/상세(`productId != null`): 마운트 시 서버 조회, 각 연산 즉시 서버 반영(backend 39).
 *   - 등록(`productId == null`): 서버 호출 없이 부모 보관 버퍼(`buffer`/`onBufferChange`)만
 *     갱신 → 부모가 상품 생성 후 `add(created.id, buffer)` 로 일괄 업로드.
 *
 * **필수 규칙**:
 *   - `useCase`/`buffer` 는 부모가 소유·주입(컴포넌트 내 신규 생성 금지).
 *   - 서버 이미지 `imageUrl` 은 `resolveThumbUrl`(http 직접 / else uploads 프록시)로 렌더.
 *     ⚠️ 대표 `Product.imageUrl` 프록시(`getImageUrl`)와 다름 — 갤러리는 이미지별 URL 이라
 *     프록시를 쓰면 모든 카드가 같은 이미지가 됨. 절대 혼용 금지.
 *   - 삭제 409 = 마스터 풀에 배치돼 사용 중 → 백엔드 메시지 안내(§5).
 *
 * ❌ 금지 패턴:
 *   - 드롭 처리를 이 컴포넌트 밖(페이지)에서 따로 구현 — 업로드 경로가 둘로 갈린다.
 *   - 등록 모드에서 서버 호출(버퍼만).
 *   - `getImageUrl(imageUrl, productId)` 로 갤러리 이미지 렌더(대표 프록시 → 전 카드 동일).
 */
interface ProductImageGalleryProps {
  productId: number | null; // null = 등록(버퍼), 값 = 수정(즉시 서버)
  useCase: ProductImageUseCase;
  buffer?: File[]; // 등록 모드: 부모 보관 업로드 대기열(순서 = 대표 후보)
  onBufferChange?: (files: File[]) => void;
  isViewMode?: boolean; // true = 조회 전용(업로드/편집 숨김)
  productName?: string; // 클립보드에 담을 때 목록에 보여줄 이름(부모 주입)
  urlBuffer?: string[]; // 등록 모드: 부모가 든 마켓 URL 대기열(저장 직후 addFromUrls 로 나간다)
  onUrlDrop?: (url: string) => void; // 등록 모드: 떨어뜨린 URL 하나를 부모에게
  onUrlRemove?: (url: string) => void; // 등록 모드: 미리보기에서 X
}

// 🔴 백엔드 가드가 요청 하나에 10장이고, 한 번에 보내는 경로가 등록 화면뿐이라 여기에만 건다.
const MAX_URL_BUFFER = 10;

const ACCEPT = 'image/jpeg,image/png';
const MAX_SIZE = 20 * 1024 * 1024;
const REJECT_MSG = 'JPEG/PNG·20MB 이하만 업로드 가능';

// Saved file name = last segment of the stored key (query stripped).
function imageFileName(imageUrl: string): string {
  const path = imageUrl.split('?')[0].replace(/\/+$/, '');
  return path.substring(path.lastIndexOf('/') + 1) || 'product-image';
}

// A row normalized across both modes. `imageId` is null in register mode.
// `downloadHref`/`downloadName` feed the [다운로드] anchor (same-origin so `download` works).
type GalleryItem = {
  key: string;
  url: string;
  imageId: number | null;
  downloadHref: string;
  downloadName: string;
  // 저장값 그대로(수정 모드만). 클립보드에 담을 때 이 값을 싣는다 — `url` 은 렌더용이라 쓰면 안 된다.
  rawUrl: string | null;
  // 등록 모드의 마켓 URL 행이면 그 URL(파일 행은 null). 이 행은 파일과 다루는 법이 다르다.
  marketUrl: string | null;
};

export function ProductImageGallery({
  productId,
  useCase,
  buffer,
  onBufferChange,
  isViewMode = false,
  productName,
  urlBuffer,
  onUrlDrop,
  onUrlRemove,
}: ProductImageGalleryProps) {
  const isEdit = productId != null;

  const [images, setImages] = useState<ProductImage[]>([]);
  const [isLoading, setIsLoading] = useState(isEdit);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const uploadRef = useRef<HTMLInputElement>(null);
  const replaceRef = useRef<HTMLInputElement>(null);
  // Which row a pending [대체] applies to (imageId in edit mode, index in register mode).
  const replaceTargetRef = useRef<{ imageId: number | null; index: number } | null>(null);

  const reload = useCallback(async () => {
    if (productId == null) return;
    const list = await useCase.list(productId);
    setImages([...list].sort((a, b) => a.sortOrder - b.sortOrder));
  }, [useCase, productId]);

  useEffect(() => {
    if (productId == null) return;
    let alive = true;
    (async () => {
      setIsLoading(true);
      setError('');
      try {
        const list = await useCase.list(productId);
        if (alive) setImages([...list].sort((a, b) => a.sortOrder - b.sortOrder));
      } catch {
        if (alive) setError('이미지를 불러오지 못했습니다.');
      } finally {
        if (alive) setIsLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [useCase, productId]);

  // Register-mode object-URL previews (revoked on change/unmount).
  const bufferFiles = buffer;
  const previews = useMemo(
    () => (isEdit ? [] : (bufferFiles ?? []).map((f) => URL.createObjectURL(f))),
    [isEdit, bufferFiles],
  );
  useEffect(() => {
    return () => previews.forEach((u) => URL.revokeObjectURL(u));
  }, [previews]);

  const items: GalleryItem[] = useMemo(() => {
    if (isEdit) {
      return images.map((img) => ({
        key: String(img.id),
        url: resolveThumbUrl(img.imageUrl),
        imageId: img.id,
        // S3 URL 은 교차 출처 → download 속성이 무시되므로 same-origin 프록시를 거친다.
        downloadHref: `/api/image-download?url=${encodeURIComponent(img.imageUrl)}`,
        downloadName: imageFileName(img.imageUrl),
        rawUrl: img.imageUrl,
        marketUrl: null,
      }));
    }
    // Register mode: the object URL is same-origin (blob:), so it downloads directly.
    const fileRows = previews.map((url, index) => ({
      key: `buf-${index}`,
      url,
      imageId: null,
      downloadHref: url,
      downloadName: bufferFiles?.[index]?.name ?? `product-image-${index + 1}`,
      rawUrl: null,
      marketUrl: null,
    }));
    // 🔴 파일이 앞, 마켓 URL 이 뒤 — 저장 순서(add → addFromUrls)와 같아야 갤러리 순서가 맞는다.
    const urlRows = (urlBuffer ?? []).map((url) => ({
      key: `url-${url}`,
      url,
      imageId: null,
      downloadHref: url,
      downloadName: '',
      rawUrl: null,
      marketUrl: url,
    }));
    return [...fileRows, ...urlRows];
  }, [isEdit, images, previews, bufferFiles, urlBuffer]);

  // Keep only JPEG/PNG ≤ 20MB; surface a banner if anything was dropped.
  const filterValid = useCallback((files: File[]): File[] => {
    const valid: File[] = [];
    let rejected = false;
    for (const f of files) {
      if (!ACCEPT.split(',').includes(f.type) || f.size > MAX_SIZE) {
        rejected = true;
        continue;
      }
      valid.push(f);
    }
    if (rejected) setError(REJECT_MSG);
    return valid;
  }, []);

  // ---- Upload ----
  // The one upload path: [이미지 업로드] 버튼과 드롭이 모두 여기로 들어온다. 새 입력 수단이
  // 생기면 File[] 을 모아 이 함수에 넘길 것 — 검증·버퍼/서버 분기를 복제하지 말 것.
  const ingestFiles = useCallback(
    async (selected: File[]) => {
      if (selected.length === 0) return;
      setError('');
      const valid = filterValid(selected);
      if (valid.length === 0) return;
      if (!isEdit) {
        onBufferChange?.([...(bufferFiles ?? []), ...valid]);
        return;
      }
      if (productId == null) return;
      setBusy(true);
      try {
        await useCase.add(productId, valid);
        await reload();
      } catch {
        setError('이미지 업로드에 실패했습니다.');
      } finally {
        setBusy(false);
      }
    },
    [filterValid, isEdit, onBufferChange, bufferFiles, productId, useCase, reload],
  );

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(e.target.files ?? []);
    e.target.value = '';
    await ingestFiles(selected);
  };

  // ---- Paste from clipboard (FEATURE_2609_62) ----
  // 담아둔 항목을 이 갤러리에 붙인다. 서버가 행만 복제하므로 파일을 다시 올리지 않는다.
  // 🔴 백엔드는 사라진 원본을 조용히 건너뛰고 200 을 준다 → 개수 비교가 유일한 판단 근거다.
  const pasteClip = useCallback(
    async (clip: ClipItem) => {
      setError('');
      // 마켓 사진은 우리 행이 아니라 URL 이라 붙이는 경로가 다르다(등록 모드도 받는다).
      if (clip.kind === 'market-image') {
        if (productId == null) {
          // 같은 마켓 URL 을 두 번 떨어뜨리면 대기열에 같은 사진이 두 장 쌓인다.
          if ((urlBuffer ?? []).includes(clip.imageUrl)) {
            setError('이미 담긴 사진입니다.');
            return;
          }
          if ((urlBuffer ?? []).length >= MAX_URL_BUFFER) {
            setError(`사진은 ${MAX_URL_BUFFER}장까지 넣을 수 있습니다.`);
            return;
          }
          onUrlDrop?.(clip.imageUrl);
          return;
        }
        setBusy(true);
        try {
          const next = await useCase.addFromUrls(productId, [clip.imageUrl]);
          setImages([...next].sort((a, b) => a.sortOrder - b.sortOrder));
        } catch (e: unknown) {
          if (axios.isAxiosError(e) && e.response?.status === 400) {
            setError('가져올 수 없는 사진입니다.');
          } else {
            setError('사진을 붙여넣지 못했습니다.');
          }
        } finally {
          setBusy(false);
        }
        return;
      }
      if (productId == null) {
        setError('상품을 저장한 뒤에 붙여넣을 수 있습니다.');
        return;
      }
      if (clipSourceImageIds(clip).length === 0) return;
      // 🔴 이미 이 갤러리에 있는 사진은 뺀다 — 같은 사진이 두 장 생기던 경로다(자기 카드를 끌어
      //    되놓거나, 이 물품에서 담아둔 항목을 같은 물품에 다시 붙이는 경우).
      //    행 id 와 저장 URL 둘 다로 본다: 예전에 복제된 행은 id 가 달라도 URL 이 같다.
      const refs =
        clip.kind === 'image'
          ? [{ productImageId: clip.productImageId, imageUrl: clip.imageUrl }]
          : clip.imageRefs;
      const ownedIds = new Set(images.map((img) => img.id));
      const ownedUrls = new Set(images.map((img) => img.imageUrl));
      const freshIds = refs
        .filter((ref) => !ownedIds.has(ref.productImageId) && !ownedUrls.has(ref.imageUrl))
        .map((ref) => ref.productImageId);
      if (freshIds.length === 0) {
        setError('이미 이 상품에 있는 사진입니다.');
        return;
      }
      const before = images.length;
      setBusy(true);
      try {
        const next = await useCase.copy(productId, freshIds);
        setImages([...next].sort((a, b) => a.sortOrder - b.sortOrder));
        const added = next.length - before;
        if (added < freshIds.length) {
          setError(
            `${freshIds.length}장 중 ${Math.max(0, added)}장만 붙였습니다. 원본이 삭제된 사진은 빠집니다.`,
          );
        }
      } catch (e: unknown) {
        if (axios.isAxiosError(e) && e.response?.status === 400) {
          setError('원본이 모두 삭제돼 붙일 수 없습니다.');
        } else {
          setError('이미지를 붙여넣지 못했습니다.');
        }
      } finally {
        setBusy(false);
      }
    },
    [productId, images, useCase, urlBuffer, onUrlDrop],
  );

  // ---- Drag & drop ----
  // dragenter/dragleave fire for every child element, so nesting depth is counted rather than
  // toggling a boolean — otherwise the overlay flickers off whenever the cursor crosses a card.
  const dragDepth = useRef(0);
  const [isDragOver, setIsDragOver] = useState(false);
  // 🔴 이 갤러리 카드에서 시작한 드래그인지. 사진을 끌어 스크롤하려다 같은 드롭존에 놓으면
  //    "자기 사진 붙여넣기" 가 돼 같은 사진이 또 올라갔다 → 그 드롭은 통째로 무시한다.
  //    `dragend` 는 drop 보다 뒤에 오므로 drop 시점에는 이 값이 아직 true 다.
  const selfDragRef = useRef(false);
  const canDrop = !isViewMode && !busy;
  // Ignore drags that carry no file (text selections, images dragged from another page).
  const hasFiles = (e: React.DragEvent) => e.dataTransfer.types.includes('Files');
  // ⚠️ dragover 에서는 getData() 를 못 읽는다(보안 제약) → 종류 판단은 types 로만.
  const hasClip = (e: React.DragEvent) => hasClipPayload(e.dataTransfer.types);
  // 자기 카드에서 시작한 드래그면 받지 않는다(겹침 표시도 뜨지 않는다).
  const accepts = (e: React.DragEvent) => !selfDragRef.current && (hasFiles(e) || hasClip(e));

  const handleDragEnter = (e: React.DragEvent) => {
    if (!canDrop || !accepts(e)) return;
    e.preventDefault();
    dragDepth.current += 1;
    setIsDragOver(true);
  };

  const handleDragOver = (e: React.DragEvent) => {
    if (!canDrop || !accepts(e)) return;
    // Required: without it the browser navigates to the dropped file instead of firing onDrop.
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  };

  const handleDragLeave = () => {
    if (!canDrop) return;
    dragDepth.current = Math.max(0, dragDepth.current - 1);
    if (dragDepth.current === 0) setIsDragOver(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    if (!canDrop || !accepts(e)) return;
    e.preventDefault();
    dragDepth.current = 0;
    setIsDragOver(false);
    if (hasClip(e)) {
      const raw = e.dataTransfer.getData(CLIP_MIME);
      if (!raw) return;
      let clip: ClipItem;
      try {
        clip = JSON.parse(raw) as ClipItem;
      } catch {
        return;
      }
      await pasteClip(clip);
      return;
    }
    await ingestFiles(Array.from(e.dataTransfer.files));
  };

  // 갤러리 카드를 끌어 툴바의 클립보드 아이콘(또는 열린 클립보드 패널)에 담는다.
  // 담기는 읽기 동작이라 조회 모드에서도 허용한다 — 상세에서 담는 것이 기본 동선이다.
  const handleCardDragStart = (e: React.DragEvent, item: GalleryItem) => {
    if (item.imageId == null || item.rawUrl == null) return;
    selfDragRef.current = true; // 이 드래그가 끝날 때까지 자기 드롭존은 닫아 둔다.
    const clip = {
      clipId: newClipId(),
      kind: 'image' as const,
      pickedAt: new Date().toISOString(),
      productId: productId as number,
      productName: productName ?? '이름 없는 물품',
      productImageId: item.imageId,
      imageUrl: item.rawUrl,
    };
    e.dataTransfer.setData(CLIP_MIME, JSON.stringify(clip));
    e.dataTransfer.effectAllowed = 'copy';
  };

  // 드롭 여부와 무관하게 드래그가 끝나면 자기 드롭존을 다시 연다(drop → dragend 순서).
  const handleCardDragEnd = () => {
    selfDragRef.current = false;
    dragDepth.current = 0;
    setIsDragOver(false);
  };

  // ---- 확대 보기 (공용 ImageLightbox) ----
  const [zoomIndex, setZoomIndex] = useState<number | null>(null);

  // ---- Replace (both modes) ----
  const triggerReplace = (item: GalleryItem, index: number) => {
    replaceTargetRef.current = { imageId: item.imageId, index };
    replaceRef.current?.click();
  };

  const handleReplaceFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    const target = replaceTargetRef.current;
    replaceTargetRef.current = null;
    if (!file || !target) return;
    setError('');
    const valid = filterValid([file]);
    if (valid.length === 0) return;
    if (!isEdit) {
      const next = [...(bufferFiles ?? [])];
      next[target.index] = valid[0];
      onBufferChange?.(next);
      return;
    }
    if (productId == null || target.imageId == null) return;
    setBusy(true);
    try {
      await useCase.replace(productId, target.imageId, valid[0]);
      await reload();
    } catch {
      setError('이미지 대체에 실패했습니다.');
    } finally {
      setBusy(false);
    }
  };

  // ---- Delete (edit → 409 guard; register → local splice) ----
  const handleDelete = async (item: GalleryItem, index: number) => {
    setError('');
    if (item.marketUrl != null) {
      onUrlRemove?.(item.marketUrl);
      return;
    }
    if (!isEdit) {
      onBufferChange?.((bufferFiles ?? []).filter((_, i) => i !== index));
      return;
    }
    if (productId == null || item.imageId == null) return;
    setBusy(true);
    try {
      await useCase.remove(productId, item.imageId);
      await reload();
    } catch (e: unknown) {
      if (axios.isAxiosError(e) && e.response?.status === 409) {
        setError(
          (e.response.data as { message?: string })?.message ??
            '다른 상품 리스팅에서 사용 중입니다. 마스터 풀 배치를 먼저 해제하세요.',
        );
      } else {
        setError('이미지 삭제에 실패했습니다.');
      }
    } finally {
      setBusy(false);
    }
  };

  // ---- Move (◀▶ adjacent swap; first = 대표) ----
  const handleMove = async (index: number, dir: -1 | 1) => {
    const target = index + dir;
    if (target < 0 || target >= items.length) return;
    // 마켓 URL 행은 파일 뒤 고정이라 순서를 바꾸지 않는다(버퍼 인덱스와 어긋난다).
    if (items[index].marketUrl != null || items[target].marketUrl != null) return;
    setError('');
    if (!isEdit) {
      const next = [...(bufferFiles ?? [])];
      [next[index], next[target]] = [next[target], next[index]];
      onBufferChange?.(next);
      return;
    }
    if (productId == null) return;
    const ids = images.map((img) => img.id);
    [ids[index], ids[target]] = [ids[target], ids[index]];
    setBusy(true);
    try {
      await useCase.reorder(productId, ids);
      await reload();
    } catch {
      setError('순서 변경에 실패했습니다.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="relative"
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <Card
        title="상품 이미지"
        action={
          <div className="flex items-center gap-3">
            {busy && <Spinner size={18} />}
            {!isViewMode && (
              <label className="cursor-pointer rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
                이미지 업로드
                <input
                  ref={uploadRef}
                  type="file"
                  accept={ACCEPT}
                  multiple
                  onChange={handleUpload}
                  disabled={busy}
                  hidden
                />
              </label>
            )}
          </div>
        }
      >
        {error && (
          <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
        )}

        {/* Shared hidden input for per-card [대체]. */}
        {!isViewMode && (
          <input
            ref={replaceRef}
            type="file"
            accept={ACCEPT}
            onChange={handleReplaceFile}
            hidden
          />
        )}

        {isEdit && isLoading ? (
          <div className="flex min-h-24 items-center justify-center">
            <Spinner size={20} label="이미지 불러오는 중..." />
          </div>
        ) : items.length === 0 ? (
          <div className="flex aspect-video w-full items-center justify-center rounded-lg border border-gray-300 bg-gray-100">
            <p className="text-gray-500">이미지 없음</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
            {items.map((item, index) => (
              <div
                key={item.key}
                draggable={item.imageId != null}
                onDragStart={(e) => handleCardDragStart(e, item)}
                onDragEnd={handleCardDragEnd}
                className="rounded-lg border border-gray-200 p-2"
              >
                <div className="relative mb-2 aspect-square overflow-hidden rounded bg-gray-100">
                  {/* 🔴 draggable={false} 없으면 브라우저가 이미지를 끌어 카드 dragstart 가 안 뜬다. */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={item.url}
                    alt="상품 이미지"
                    draggable={false}
                    onClick={() => setZoomIndex(index)}
                    className="h-full w-full cursor-zoom-in object-contain"
                  />
                  {index === 0 && (
                    <span className="absolute left-1 top-1 rounded bg-blue-600 px-1.5 py-0.5 text-[10px] font-medium text-white">
                      대표
                    </span>
                  )}
                </div>
                <div className="space-y-1">
                  {/* 마켓 URL 행: 지우기만 한다(대체·순서·다운로드는 이 행에 맞지 않는다). */}
                  {item.marketUrl != null ? (
                    !isViewMode && (
                      <button
                        type="button"
                        onClick={() => handleDelete(item, index)}
                        className="w-full rounded border border-red-300 px-1.5 py-0.5 text-[11px] text-red-600 hover:bg-red-50"
                      >
                        삭제
                      </button>
                    )
                  ) : (
                    <>
                      {!isViewMode && (
                        <>
                          <div className="flex gap-1">
                            <button
                              type="button"
                              onClick={() => handleMove(index, -1)}
                              disabled={busy || index === 0}
                              aria-label="앞으로"
                              className="flex-1 rounded border border-gray-300 px-1 py-0.5 text-xs text-gray-600 hover:bg-gray-100 disabled:opacity-40"
                            >
                              ◀
                            </button>
                            <button
                              type="button"
                              onClick={() => handleMove(index, 1)}
                              disabled={busy || index === items.length - 1}
                              aria-label="뒤로"
                              className="flex-1 rounded border border-gray-300 px-1 py-0.5 text-xs text-gray-600 hover:bg-gray-100 disabled:opacity-40"
                            >
                              ▶
                            </button>
                          </div>
                          <button
                            type="button"
                            onClick={() => triggerReplace(item, index)}
                            disabled={busy}
                            className="w-full rounded border border-gray-300 px-1.5 py-0.5 text-[11px] text-gray-700 hover:bg-gray-100 disabled:opacity-50"
                          >
                            대체
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(item, index)}
                            disabled={busy}
                            className="w-full rounded border border-red-300 px-1.5 py-0.5 text-[11px] text-red-600 hover:bg-red-50 disabled:opacity-50"
                          >
                            삭제
                          </button>
                        </>
                      )}
                      {/* Read-only action: available in view mode too. */}
                      <a
                        href={item.downloadHref}
                        download={item.downloadName}
                        className="block w-full rounded border border-gray-300 px-1.5 py-0.5 text-center text-[11px] text-gray-700 hover:bg-gray-100"
                      >
                        다운로드
                      </a>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <ImageLightbox
        images={items.map((item) => ({ url: item.url, alt: productName ?? '상품 이미지' }))}
        index={zoomIndex}
        onIndexChange={setZoomIndex}
        onClose={() => setZoomIndex(null)}
      />

      {/* pointer-events-none 필수 — 이 층이 드롭을 먹으면 onDrop 이 안 뜬다. */}
      {isDragOver && (
        <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center rounded-lg border-2 border-dashed border-blue-500 bg-blue-50/80">
          <p className="text-sm font-medium text-blue-700">
            여기에 놓기 — 사진 파일은 업로드(JPEG/PNG · 20MB 이하), 클립보드 항목은 붙여넣기
          </p>
        </div>
      )}
    </div>
  );
}
