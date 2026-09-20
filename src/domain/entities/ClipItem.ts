/**
 * 클립보드에 담긴 한 덩어리 (FEATURE_2609_62).
 *
 * 텍스트는 **값 스냅샷**(담는 순간의 값 — 원본이 바뀌어도 따라가지 않는다),
 * 이미지는 **참조**(`productImageId` — 재업로드하지 않고 붙일 때 서버가 행만 복제한다).
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
    };

/** 드래그 전송 형식. 🔴 소문자 고정 — 브라우저가 type 을 소문자로 정규화한다. */
export const CLIP_MIME = 'application/x-oklyx-clip';

/** 이 드래그가 클립보드 항목을 실어 나르는지 — `dragover` 에서는 `getData()` 를 못 읽어 types 로만 본다. */
export function hasClipPayload(types: readonly string[]): boolean {
  return types.includes(CLIP_MIME);
}

/** 한 항목이 붙일 이미지 id 목록 — `image` 는 1장, `product` 는 담아둔 갤러리 전부. */
export function clipSourceImageIds(item: ClipItem): number[] {
  return item.kind === 'image' ? [item.productImageId] : item.imageRefs.map((ref) => ref.productImageId);
}
