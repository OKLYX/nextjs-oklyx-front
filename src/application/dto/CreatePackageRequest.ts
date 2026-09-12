export interface CreatePackageRequest {
  type: string;
  cost: number;
  widthCm: number;
  lengthCm: number;
  heightCm: number;
  effectiveDate: string;
  isDefault: boolean;
}
