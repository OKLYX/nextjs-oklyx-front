export interface CarrierRate {
  id: number;
  carrier: string;
  type: string;
  cost: number;
  effectiveDate: string;
  isDefault: boolean;
}
