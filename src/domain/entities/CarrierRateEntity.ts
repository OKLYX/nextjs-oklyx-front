export interface CarrierRate {
  id: number;
  carrierId: number;
  carrier: string;
  type: string;
  cost: number;
  effectiveDate: string;
  isDefault: boolean;
}
