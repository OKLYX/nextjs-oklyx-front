export interface Seller {
  id: number;
  sellerName: string;
  businessRegistration: string;
  createdAt: string;
  updatedAt: string;
  // "옵션확인" 접미사 판매자 기본값 (69). null = 상속(시스템 기본). getById 응답에 노출.
  optionCheckSuffixEnabled?: boolean | null;
  optionCheckSuffix?: string | null;
}
