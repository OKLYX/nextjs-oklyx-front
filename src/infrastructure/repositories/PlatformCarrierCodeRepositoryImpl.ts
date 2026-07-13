import { axiosInstance } from '@/infrastructure/api/axiosInstance';
import type { PlatformCarrierCode } from '@/domain/entities/PlatformCarrierCodeEntity';
import type { PlatformCarrierCodeRepository } from '@/domain/repositories/PlatformCarrierCodeRepository';
import type {
  CreatePlatformCarrierCodeRequest,
  UpdatePlatformCarrierCodeRequest,
} from '@/application/dto/PlatformCarrierCodeDTOs';

export class PlatformCarrierCodeRepositoryImpl implements PlatformCarrierCodeRepository {
  async getCodes(carrierId: number): Promise<PlatformCarrierCode[]> {
    const response = await axiosInstance.get(`/api/admin/carriers/${carrierId}/platform-codes`);
    return response.data.data;
  }

  async create(
    carrierId: number,
    data: CreatePlatformCarrierCodeRequest,
  ): Promise<PlatformCarrierCode> {
    const response = await axiosInstance.post(
      `/api/admin/carriers/${carrierId}/platform-codes`,
      data,
    );
    return response.data.data;
  }

  async update(
    carrierId: number,
    codeId: number,
    data: UpdatePlatformCarrierCodeRequest,
  ): Promise<PlatformCarrierCode> {
    const response = await axiosInstance.patch(
      `/api/admin/carriers/${carrierId}/platform-codes/${codeId}`,
      data,
    );
    return response.data.data;
  }

  async delete(carrierId: number, codeId: number): Promise<void> {
    await axiosInstance.delete(`/api/admin/carriers/${carrierId}/platform-codes/${codeId}`);
  }
}
