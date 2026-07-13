export interface UpdateCarrierRateRequest {
  carrierId: number;
  type: string;
  cost: number;
  effectiveDate: string;
  isDefault: boolean;
}
