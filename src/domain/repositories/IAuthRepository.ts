import { LoginRequestDto } from '@/application/dto/LoginRequestDto';
import { LoginResponseDto } from '@/application/dto/LoginResponseDto';

export interface IAuthRepository {
  login(request: LoginRequestDto): Promise<LoginResponseDto>;
}
