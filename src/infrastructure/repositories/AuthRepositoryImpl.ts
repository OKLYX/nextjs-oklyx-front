import { AuthRepository } from '@/domain/repositories/AuthRepository';
import { LoginRequestDto } from '@/application/dto/LoginRequestDto';
import { LoginResponseDto } from '@/application/dto/LoginResponseDto';
import { axiosInstance } from '@/infrastructure/api/axiosInstance';

export class AuthRepositoryImpl implements AuthRepository {
  async login(request: LoginRequestDto): Promise<LoginResponseDto> {
    const response = await axiosInstance.post<LoginResponseDto>('/api/auth/login', request);
    return response.data;
  }
}
