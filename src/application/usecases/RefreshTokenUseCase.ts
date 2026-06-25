import { IAuthRepository } from '@/domain/repositories/IAuthRepository';
import { tokenStorage } from '@/infrastructure/auth/tokenStorage';
import type { LoginResponseDto } from '@/application/dto/LoginResponseDto';

export class RefreshTokenUseCase {
  constructor(private authRepository: IAuthRepository) {}

  async refresh(refreshToken: string): Promise<LoginResponseDto> {
    const response = await this.authRepository.refresh(refreshToken);
    tokenStorage.setToken(response.token);
    tokenStorage.setRefreshToken(response.refreshToken);
    return response;
  }
}
