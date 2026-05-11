import { axiosInstance } from '@/infrastructure/api/axiosInstance';
import type { CreateUserRequest, UserRepository } from '@/domain/repositories/UserRepository';
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
}
