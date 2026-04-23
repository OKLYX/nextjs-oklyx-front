export interface LoginResponseDto {
  token: string;
  tokenType: string;
  email: string;
  name: string;
  role: string;
  expiresIn: number;
}
