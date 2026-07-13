import type { Carrier } from '@/domain/entities/CarrierEntity';
import type { CarrierRepository } from '@/domain/repositories/CarrierRepository';
import type { CreateCarrierRequest, UpdateCarrierRequest } from '@/application/dto/CarrierDTOs';

export class CarrierUseCase {
  constructor(private repository: CarrierRepository) {}

  async getAll(): Promise<Carrier[]> {
    return this.repository.getCarriers();
  }

  async getById(id: number): Promise<Carrier> {
    return this.repository.getCarrier(id);
  }

  async create(data: CreateCarrierRequest): Promise<Carrier> {
    return this.repository.createCarrier(data);
  }

  async update(id: number, data: UpdateCarrierRequest): Promise<Carrier> {
    return this.repository.updateCarrier(id, data);
  }

  async delete(id: number): Promise<void> {
    return this.repository.deleteCarrier(id);
  }
}
