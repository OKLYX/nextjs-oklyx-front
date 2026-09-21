/**
 * 상자(포장재) 한 종류.
 *
 * `boxKind` 는 **판매가 계산에 쓸 수 있는 상자인가**를 가른다(PLAN 2609_40 D20 · D21):
 * 재활용 상자는 비용이 0 이라 판매가 계산 목록에 뜨면 원가 0 짜리 상자로 값이 매겨진다.
 * 그래서 계산용 드롭다운은 전부 `getPackages('PURCHASED')` 로 부른다.
 */
export type BoxKind = 'PURCHASED' | 'RECYCLED';

export const BOX_KIND_LABEL: Record<BoxKind, string> = {
  PURCHASED: '구매 상자',
  RECYCLED: '재활용 상자',
};

/** 서버가 `boxKind` 를 안 주던 시절 데이터 = 구매 상자(백엔드 기본값과 같은 규칙). */
export const boxKindOf = (pkg: Pick<Package, 'boxKind'>): BoxKind => pkg.boxKind ?? 'PURCHASED';

export interface Package {
  id: number;
  type: string;
  cost: number;
  widthCm: number;
  lengthCm: number;
  heightCm: number;
  isDefault: boolean;
  /** 구매 / 재활용. 옛 응답에는 없을 수 있어 `boxKindOf` 로 읽는다 */
  boxKind?: BoxKind;
  /** 상자 사진. 없으면 화면이 치수 비율 도형(`BoxShape`)을 그린다 (D26) */
  imageUrl?: string | null;
}
