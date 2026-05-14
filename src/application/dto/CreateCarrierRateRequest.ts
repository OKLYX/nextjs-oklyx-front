export interface CreateCarrierRateRequest {
  carrier: string;
  type: string;
  cost: number;
  effectiveDate: string;
  isDefault: boolean;
}
