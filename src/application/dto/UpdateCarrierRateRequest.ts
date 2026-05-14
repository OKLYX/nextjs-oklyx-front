export interface UpdateCarrierRateRequest {
  carrier: string;
  type: string;
  cost: number;
  effectiveDate: string;
  isDefault: boolean;
}
