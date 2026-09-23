export interface Product {
  id: number;
  productName: string;
  brand: string;
  price: number;
  store: string;
  active: boolean;
  createdDate: string;
  modifiedDate?: string;
  barcodeId?: string;
  netContentUnit?: string;
  packageHeight?: string;
  packageLength?: string;
  packageWidth?: string;
  netContent?: string;
  description?: string;
  name?: string;
  imageUrl?: string;
  /**
   * 이 물품이 연결된 판매채널(채널 셀) 수 — 「연결 현황」과 같은 정의.
   *
   * ⚠️ optional: 백엔드가 아직 이 필드를 안 내려주는 환경에서는 `undefined` 다.
   * 🔴 `undefined` 를 0 으로 읽지 말 것 — 모르는 것(`-`)과 없는 것(`0`)은 다르다.
   */
  channelCount?: number;
}
