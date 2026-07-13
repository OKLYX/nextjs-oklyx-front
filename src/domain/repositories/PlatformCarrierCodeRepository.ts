import type { PlatformCarrierCode } from '@/domain/entities/PlatformCarrierCodeEntity';
import type {
  CreatePlatformCarrierCodeRequest,
  UpdatePlatformCarrierCodeRequest,
} from '@/application/dto/PlatformCarrierCodeDTOs';

export interface PlatformCarrierCodeRepository {
  getCodes(carrierId: number): Promise<PlatformCarrierCode[]>;
  create(carrierId: number, data: CreatePlatformCarrierCodeRequest): Promise<PlatformCarrierCode>;
  update(
    carrierId: number,
    codeId: number,
    data: UpdatePlatformCarrierCodeRequest,
  ): Promise<PlatformCarrierCode>;
  delete(carrierId: number, codeId: number): Promise<void>;
}
