import { axiosInstance } from '@/infrastructure/api/axiosInstance';
import type { CreateUserRequest, GetUsersParams, GetUsersResponse, UpdateUserRequest, UserRepository } from '@/domain/repositories/UserRepository';
import type { User } from '@/domain/entities/User';

export class UserRepositoryImpl implements UserRepository {
  async checkEmailExists(email: string): Promise<boolean> {
    const response = await axiosInstance.get('/api/users/check-email', {
      params: { email },
    });
    return response.data.data.exists;
  }

  async createUser(data: CreateUserRequest): Promise<User> {
    const response = await axiosInstance.post('/api/users', data);
    return response.data.data;
  }

  async getUsers(params: GetUsersParams): Promise<GetUsersResponse> {
    const queryParams: Record<string, string | number> = {
      page: params.page ?? 0,
      size: params.size ?? 20,
    };

    // API has single 'search' param (not separate name/email)
    // Priority: name > email when both provided
    if (params.name) {
      queryParams.search = params.name;
    } else if (params.email) {
      queryParams.search = params.email;
    }

    const response = await axiosInstance.get('/api/users', {
      params: queryParams,
    });
    return response.data.data;
  }

  async updateUser(id: number, data: UpdateUserRequest): Promise<User> {
    const response = await axiosInstance.patch(`/api/users/${id}`, data);
    return response.data.data;
  }
}
