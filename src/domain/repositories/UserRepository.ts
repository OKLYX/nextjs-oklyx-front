import type { User } from '@/domain/entities/User';

export interface CreateUserRequest {
  email: string;
  password: string;
  name: string;
}

export interface CheckEmailResponse {
  exists: boolean;
}

export interface UserRepository {
  checkEmailExists(email: string): Promise<boolean>;
  createUser(data: CreateUserRequest): Promise<User>;
}
