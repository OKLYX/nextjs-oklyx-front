import type { CarrierRate } from '@/domain/entities/CarrierRateEntity';
import type { CarrierRateRepository } from '@/domain/repositories/CarrierRateRepository';
import type { CreateCarrierRateRequest } from '@/application/dto/CreateCarrierRateRequest';
import type { UpdateCarrierRateRequest } from '@/application/dto/UpdateCarrierRateRequest';

export class CarrierRateUseCase {
  constructor(private repository: CarrierRateRepository) {}

  async getCarrierRates(): Promise<CarrierRate[]> {
    return this.repository.getCarrierRates();
  }

  async createCarrierRate(data: CreateCarrierRateRequest): Promise<CarrierRate> {
    return this.repository.createCarrierRate(data);
  }

  async updateCarrierRate(id: number, data: UpdateCarrierRateRequest): Promise<CarrierRate> {
    return this.repository.updateCarrierRate(id, data);
  }
}
