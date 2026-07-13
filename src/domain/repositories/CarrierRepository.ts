import type { Carrier } from '@/domain/entities/CarrierEntity';
import type { CreateCarrierRequest, UpdateCarrierRequest } from '@/application/dto/CarrierDTOs';

export interface CarrierRepository {
  getCarriers(): Promise<Carrier[]>;
  getCarrier(id: number): Promise<Carrier>;
  createCarrier(data: CreateCarrierRequest): Promise<Carrier>;
  updateCarrier(id: number, data: UpdateCarrierRequest): Promise<Carrier>;
  deleteCarrier(id: number): Promise<void>;
}
