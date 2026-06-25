import { LoginRequestDto } from '@/application/dto/LoginRequestDto';
import { LoginResponseDto } from '@/application/dto/LoginResponseDto';

export interface IAuthRepository {
  login(request: LoginRequestDto): Promise<LoginResponseDto>;
  refresh(refreshToken: string): Promise<LoginResponseDto>;
  logout(refreshToken: string): Promise<void>;
  me(): Promise<LoginResponseDto>;
}
