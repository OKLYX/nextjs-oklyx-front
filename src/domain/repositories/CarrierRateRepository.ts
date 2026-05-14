import type { CarrierRate } from '@/domain/entities/CarrierRateEntity';

export interface CarrierRateRepository {
  getCarrierRates(): Promise<CarrierRate[]>;
  createCarrierRate(data: {
    carrier: string;
    type: string;
    cost: number;
    effectiveDate: string;
    isDefault: boolean;
  }): Promise<CarrierRate>;
  updateCarrierRate(id: number, data: {
    carrier: string;
    type: string;
    cost: number;
    effectiveDate: string;
    isDefault: boolean;
  }): Promise<CarrierRate>;
}
