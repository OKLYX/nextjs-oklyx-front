import type { BoxKind } from '@/domain/entities/PackageEntity';

export interface UpdatePackageRequest {
  type: string;
  cost: number;
  widthCm: number;
  lengthCm: number;
  heightCm: number;
  isDefault: boolean;
  /** 구매 / 재활용 (PLAN 2609_40 D20). 이미지는 이 요청에 없다 — 전용 업로드가 소유한다 */
  boxKind: BoxKind;
}
