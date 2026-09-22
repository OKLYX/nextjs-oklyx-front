import type { Product } from '@/domain/entities/Product';
import type { ProductUsage } from '@/domain/entities/ProductUsage';
import type { ProductImage } from '@/domain/entities/ProductImage';
import type { MergedProductFields } from '@/domain/repositories/ProductMergeRepository';
import { formatKrw } from '@/infrastructure/utils/money';

/** 병합 화면에서 사람이 고르는 항목. 🔴 백엔드 `MergedFields` 와 같은 집합이다(대표 사진 제외). */
export type MergeFieldKey =
  | 'productName'
  | 'brand'
  | 'barcodeId'
  | 'store'
  | 'price'
  | 'description'
  | 'netContent'
  | 'netContentUnit'
  | 'packageHeight'
  | 'packageLength'
  | 'packageWidth';

export const MERGE_FIELDS: { key: MergeFieldKey; label: string }[] = [
  { key: 'productName', label: '상품명' },
  { key: 'brand', label: '브랜드' },
  { key: 'barcodeId', label: '바코드' },
  { key: 'store', label: '구매처' },
  { key: 'price', label: '가격' },
  { key: 'netContent', label: '내용물 양' },
  { key: 'netContentUnit', label: '단위' },
  { key: 'packageHeight', label: '높이' },
  { key: 'packageLength', label: '길이' },
  { key: 'packageWidth', label: '너비' },
  { key: 'description', label: '설명' },
];

/** 좌우 어느 쪽인지. 「남길 쪽」은 `keepSide` 로 따로 들고 다닌다. */
export type MergeSide = 'left' | 'right';

export function otherSide(side: MergeSide): MergeSide {
  return side === 'left' ? 'right' : 'left';
}

/** 한쪽 물품이 화면에 필요한 것 전부. 셋 다 같은 시점에 실린다. */
export interface MergeSideData {
  product: Product;
  usage: ProductUsage;
  images: ProductImage[];
}

/** 비교용 원본 값. 가격만 숫자고 나머지는 문자열이다(서버 컬럼이 VARCHAR). */
export function fieldValue(product: Product, key: MergeFieldKey): string | number | null {
  const raw = product[key];
  if (raw === undefined || raw === null) return null;
  if (typeof raw === 'number') return raw;
  const text = String(raw).trim();
  return text === '' ? null : text;
}

export function fieldText(product: Product, key: MergeFieldKey): string {
  const value = fieldValue(product, key);
  if (value === null) return '';
  return key === 'price' ? formatKrw(Number(value)) : String(value);
}

export function isSameField(left: Product, right: Product, key: MergeFieldKey): boolean {
  return fieldValue(left, key) === fieldValue(right, key);
}

/**
 * 항목별 기본 선택 — **남길 쪽 값이 기본**이고, 남길 쪽이 비어 있을 때만 채워진 쪽을 고른다.
 * 🔴 이것은 추천이 아니다. 「남길 쪽은 자기 값을 그대로 이어간다」는 규칙의 결과일 뿐이다(PLAN).
 */
export function defaultFieldChoices(
  keep: Product,
  discard: Product,
  keepSide: MergeSide
): Record<MergeFieldKey, MergeSide> {
  const choices = {} as Record<MergeFieldKey, MergeSide>;
  for (const { key } of MERGE_FIELDS) {
    const keepEmpty = fieldValue(keep, key) === null;
    const discardFilled = fieldValue(discard, key) !== null;
    choices[key] = keepEmpty && discardFilled ? otherSide(keepSide) : keepSide;
  }
  return choices;
}

/**
 * 요청 바디의 `fields`. 🔴 **남길 쪽을 고른 항목은 null 로 보낸다** — 서버에서 null 은
 * 「남길 물품의 값을 그대로 둔다」는 뜻이라, 고르지 않은 값이 섞여 들어갈 길이 없다.
 */
export function buildMergedFields(
  keep: Product,
  discard: Product,
  keepSide: MergeSide,
  choices: Record<MergeFieldKey, MergeSide>,
  representativeImageId: number | null
): MergedProductFields {
  const pick = (key: MergeFieldKey): string | null => {
    if (choices[key] === keepSide) return null;
    const value = fieldValue(discard, key);
    return value === null ? null : String(value);
  };
  const price =
    choices.price === keepSide ? null : ((fieldValue(discard, 'price') as number | null) ?? null);

  return {
    productName: pick('productName'),
    brand: pick('brand'),
    barcodeId: pick('barcodeId'),
    store: pick('store'),
    price,
    description: pick('description'),
    netContent: pick('netContent'),
    netContentUnit: pick('netContentUnit'),
    packageHeight: pick('packageHeight'),
    packageLength: pick('packageLength'),
    packageWidth: pick('packageWidth'),
    representativeImageId,
  };
}

/** 이관 항목 표시 순서·문구. 키는 백엔드 `TransferOptions` 필드명과 같다. */
export const TRANSFER_ROWS: {
  key: 'purchaseRecords' | 'stockMovements' | 'shipmentItems' | 'images' | 'shoppingListItems' | 'priceChangeLogs';
  label: string;
  shortLabel: string;
  unit: string;
  /** 건수를 어디서 읽는지 (`ProductUsage.history`) */
  countKey: keyof ProductUsage['history'];
  note?: string;
}[] = [
  { key: 'purchaseRecords', label: '매입 이력', shortLabel: '매입', unit: '건', countKey: 'purchaseRecords' },
  { key: 'stockMovements', label: '재고 이동', shortLabel: '재고', unit: '건', countKey: 'stockMovements' },
  { key: 'shipmentItems', label: '발송 내역', shortLabel: '발송', unit: '건', countKey: 'shipmentItems' },
  { key: 'images', label: '사진', shortLabel: '사진', unit: '장', countKey: 'images' },
  {
    key: 'shoppingListItems',
    label: '구매목록',
    shortLabel: '구매목록',
    unit: '건',
    countKey: 'shoppingListItems',
    note: '같은 주문 라인에 양쪽이 있으면 버릴 쪽은 버립니다',
  },
  { key: 'priceChangeLogs', label: '가격 이력', shortLabel: '가격이력', unit: '건', countKey: 'priceChangeLogs' },
];

/** 병합 결과(`moved`)를 「매입 3 · 재고 12 · 사진 4」로. 0건은 빼고 적는다. */
export function movedSummary(moved: Record<string, number>): string {
  const parts = TRANSFER_ROWS.filter((row) => (moved[row.key] ?? 0) > 0).map(
    (row) => `${row.shortLabel} ${moved[row.key]}`
  );
  return parts.join(' · ');
}
