import { axiosInstance } from '@/infrastructure/api/axiosInstance';
import type { Carrier } from '@/domain/entities/CarrierEntity';
import type { CarrierRepository } from '@/domain/repositories/CarrierRepository';
import type { CreateCarrierRequest, UpdateCarrierRequest } from '@/application/dto/CarrierDTOs';

export class CarrierRepositoryImpl implements CarrierRepository {
  async getCarriers(): Promise<Carrier[]> {
    const response = await axiosInstance.get('/api/admin/carriers');
    return response.data.data;
  }

  async getCarrier(id: number): Promise<Carrier> {
    const response = await axiosInstance.get(`/api/admin/carriers/${id}`);
    return response.data.data;
  }

  async createCarrier(data: CreateCarrierRequest): Promise<Carrier> {
    const response = await axiosInstance.post('/api/admin/carriers', data);
    return response.data.data;
  }

  async updateCarrier(id: number, data: UpdateCarrierRequest): Promise<Carrier> {
    const response = await axiosInstance.patch(`/api/admin/carriers/${id}`, data);
    return response.data.data;
  }

  async deleteCarrier(id: number): Promise<void> {
    await axiosInstance.delete(`/api/admin/carriers/${id}`);
  }
}
