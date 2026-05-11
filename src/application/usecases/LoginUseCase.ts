import { IAuthRepository } from '@/domain/repositories/IAuthRepository';
import { tokenStorage } from '@/infrastructure/auth/tokenStorage';
import type { LoginResponseDto } from '@/application/dto/LoginResponseDto';

export class LoginUseCase {
  constructor(private authRepository: IAuthRepository) {}

  async login(email: string, password: string): Promise<LoginResponseDto> {
    try {
      const response = await this.authRepository.login({ email, password });
      tokenStorage.setToken(response.token);
      return response;
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(error.message);
      }
      throw new Error('Login failed. Please try again.');
    }
  }
}
