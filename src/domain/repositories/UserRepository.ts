import type { User } from '@/domain/entities/User';

export interface CreateUserRequest {
  email: string;
  password: string;
  name: string;
}

export interface CheckEmailResponse {
  exists: boolean;
}

export interface GetUsersParams {
  name?: string;
  email?: string;
  page?: number;
  size?: number;
}

export interface GetUsersResponse {
  content: User[];
  totalPages: number;
  totalElements: number;
  number: number;
  first: boolean;
  last: boolean;
}

export interface UpdateUserRequest {
  name?: string;
  email?: string;
  password?: string;
  role?: 'GUEST' | 'USER' | 'ADMIN';
}

export interface UserRepository {
  checkEmailExists(email: string): Promise<boolean>;
  createUser(data: CreateUserRequest): Promise<User>;
  getUsers(params: GetUsersParams): Promise<GetUsersResponse>;
  updateUser(id: number, data: UpdateUserRequest): Promise<User>;
}
