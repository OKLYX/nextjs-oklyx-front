import type { CarrierRate } from '@/domain/entities/CarrierRateEntity';

export interface CarrierRateRepository {
  getCarrierRates(): Promise<CarrierRate[]>;
  createCarrierRate(data: {
    carrierId: number;
    type: string;
    cost: number;
    effectiveDate: string;
    isDefault: boolean;
  }): Promise<CarrierRate>;
  updateCarrierRate(id: number, data: {
    carrierId: number;
    type: string;
    cost: number;
    effectiveDate: string;
    isDefault: boolean;
  }): Promise<CarrierRate>;
  deleteCarrierRate(id: number): Promise<void>;
}
