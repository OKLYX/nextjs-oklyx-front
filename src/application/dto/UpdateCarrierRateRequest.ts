export interface UpdateCarrierRateRequest {
  carrierId: number;
  type: string;
  cost: number;
  // Optional: omitted means "from today" on create and "keep as is" on update.
  effectiveDate?: string;
  isDefault: boolean;
}
