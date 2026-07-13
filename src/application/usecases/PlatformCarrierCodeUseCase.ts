import type { PlatformCarrierCode } from '@/domain/entities/PlatformCarrierCodeEntity';
import type { PlatformCarrierCodeRepository } from '@/domain/repositories/PlatformCarrierCodeRepository';
import type {
  CreatePlatformCarrierCodeRequest,
  UpdatePlatformCarrierCodeRequest,
} from '@/application/dto/PlatformCarrierCodeDTOs';

export class PlatformCarrierCodeUseCase {
  constructor(private repository: PlatformCarrierCodeRepository) {}

  async getCodes(carrierId: number): Promise<PlatformCarrierCode[]> {
    return this.repository.getCodes(carrierId);
  }

  async create(
    carrierId: number,
    data: CreatePlatformCarrierCodeRequest,
  ): Promise<PlatformCarrierCode> {
    return this.repository.create(carrierId, data);
  }

  async update(
    carrierId: number,
    codeId: number,
    data: UpdatePlatformCarrierCodeRequest,
  ): Promise<PlatformCarrierCode> {
    return this.repository.update(carrierId, codeId, data);
  }

  async delete(carrierId: number, codeId: number): Promise<void> {
    return this.repository.delete(carrierId, codeId);
  }
}
