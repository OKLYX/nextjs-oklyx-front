import type { BoxKind } from '@/domain/entities/PackageEntity';

export interface CreatePackageRequest {
  type: string;
  cost: number;
  widthCm: number;
  lengthCm: number;
  heightCm: number;
  isDefault: boolean;
  /** 구매 / 재활용 (PLAN 2609_40 D20). 재활용은 비용 0 을 허용하고 기본 상자가 될 수 없다 */
  boxKind: BoxKind;
}
