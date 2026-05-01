import { IAuthRepository } from '@/domain/repositories/IAuthRepository';
import { LoginRequestDto } from '@/application/dto/LoginRequestDto';
import { LoginResponseDto } from '@/application/dto/LoginResponseDto';
import { axiosInstance } from '@/infrastructure/api/axiosInstance';

export class AuthRepositoryImpl implements IAuthRepository {
  async login(request: LoginRequestDto): Promise<LoginResponseDto> {
    const response = await axiosInstance.post('/api/auth/login', request);
    return response.data.data;
  }
}
