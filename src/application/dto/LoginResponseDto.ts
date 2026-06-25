export interface LoginResponseDto {
  token: string;
  refreshToken: string;
  tokenType: string;
  email: string;
  name: string;
  role: string;
  expiresIn: number;
}
