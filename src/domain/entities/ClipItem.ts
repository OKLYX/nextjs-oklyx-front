/**
 * 클립보드에 담긴 한 덩어리 (FEATURE_2609_62 · 2609_68 에서 종류가 셋이 되었다).
 *
 * 텍스트는 **값 스냅샷**(담는 순간의 값 — 원본이 바뀌어도 따라가지 않는다),
 * 이미지는 **참조**(`productImageId` — 재업로드하지 않고 붙일 때 서버가 행만 복제한다).
 *
 * 🔴 종류에 따라 **붙이는 경로가 다르다**:
 *   - `product` · `image` = 우리 서버 행 참조 → `ProductImageUseCase.copy`(`clipSourceImageIds`)
 *   - `market-image`      = 남의 URL → `ProductImageUseCase.addFromUrls`(서버가 내려받아 복제한다)
 *
 * 🔴 `productName`·`barcodeId` 는 일부러 `ClipValues` 에 없다:
 *   - `barcodeId` = 물품을 구분하는 값. 복제하면 중복 바코드가 생긴다
 *   - `productName` = `ClipItem` 최상단에 이미 있다(목록 표시용). 폼 필드로는 채우지 않는다
 */
export interface ClipValues {
  brand?: string;
  store?: string;
  /** 🔴 number 가 아니다 — ProductEditForm 의 RHF 필드가 전부 string 이다. */
  price?: string;
  netContent?: string;
  netContentUnit?: string;
  packageWidth?: string;
  packageLength?: string;
  packageHeight?: string;
  description?: string;
}

export interface ClipImageRef {
  productImageId: number;
  /** 미리보기용 **저장값**(`ProductImage.imageUrl`). 렌더는 `resolveThumbUrl` 경유. */
  imageUrl: string;
}

export type ClipItem =
  | {
      clipId: string;
      kind: 'product';
      pickedAt: string;
      productId: number;
      productName: string;
      values: ClipValues;
      imageRefs: ClipImageRef[];
    }
  | {
      clipId: string;
      kind: 'image';
      pickedAt: string;
      productId: number;
      productName: string;
      productImageId: number;
      imageUrl: string;
    }
  /** 마켓에서 끌어온 사진 한 장 (2609_68). 🔴 우리 서버 행이 아니라 **남의 URL** 이다. */
  | {
      clipId: string;
      kind: 'market-image';
      pickedAt: string;
      /** 마켓 원본 URL(https). 프록시·`resolveThumbUrl` 을 태우지 않는다 — 이미 절대 주소다. */
      imageUrl: string;
      /** 어디서 온 사진인지 — 말풍선 목록에 보여준다. */
      platformProductId: string;
      productName: string;
    };

/** 드래그 전송 형식. 🔴 소문자 고정 — 브라우저가 type 을 소문자로 정규화한다. */
export const CLIP_MIME = 'application/x-oklyx-clip';

/** 이 드래그가 클립보드 항목을 실어 나르는지 — `dragover` 에서는 `getData()` 를 못 읽어 types 로만 본다. */
export function hasClipPayload(types: readonly string[]): boolean {
  return types.includes(CLIP_MIME);
}

/** 마켓 사진인지 — 붙이는 경로가 다르므로 종류로 먼저 가른다. */
export function isMarketClip(item: ClipItem): item is Extract<ClipItem, { kind: 'market-image' }> {
  return item.kind === 'market-image';
}

/**
 * 한 항목이 붙일 이미지 id 목록 — `image` 는 1장, `product` 는 담아둔 갤러리 전부.
 *
 * 🔴 `market-image` 는 서버 행이 아니라 URL 이라 **빈 배열**이다. 이 함수로는 못 붙인다는 뜻 —
 *    `ProductImageUseCase.addFromUrls` 로 보내야 한다.
 */
export function clipSourceImageIds(item: ClipItem): number[] {
  if (item.kind === 'market-image') return [];
  return item.kind === 'image' ? [item.productImageId] : item.imageRefs.map((ref) => ref.productImageId);
}
