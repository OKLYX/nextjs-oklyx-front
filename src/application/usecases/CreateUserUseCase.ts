import type { CreateUserRequest, UserRepository } from '@/domain/repositories/UserRepository';
import type { User } from '@/domain/entities/User';

export class CreateUserUseCase {
  constructor(private repository: UserRepository) {}

  async checkEmailExists(email: string): Promise<boolean> {
    return this.repository.checkEmailExists(email);
  }

  async createUser(data: CreateUserRequest): Promise<User> {
    return this.repository.createUser(data);
  }
}
