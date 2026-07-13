export interface CreateCarrierRateRequest {
  carrierId: number;
  type: string;
  cost: number;
  effectiveDate: string;
  isDefault: boolean;
}
