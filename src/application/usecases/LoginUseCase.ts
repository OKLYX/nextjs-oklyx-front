import { AuthRepository } from '@/domain/repositories/AuthRepository';
import { tokenStorage } from '@/infrastructure/auth/tokenStorage';

export class LoginUseCase {
  constructor(private authRepository: AuthRepository) {}

  async login(email: string, password: string): Promise<void> {
    try {
      const response = await this.authRepository.login({ email, password });
      tokenStorage.setToken(response.token);
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(error.message);
      }
      throw new Error('Login failed. Please try again.');
    }
  }
}
