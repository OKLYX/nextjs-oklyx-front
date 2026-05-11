import type { UpdateUserRequest, UserRepository } from '@/domain/repositories/UserRepository';
import type { User } from '@/domain/entities/User';

export class UpdateUserUseCase {
  constructor(private repository: UserRepository) {}

  async checkEmailExists(email: string): Promise<boolean> {
    return this.repository.checkEmailExists(email);
  }

  async updateUser(id: number, data: UpdateUserRequest): Promise<User> {
    try {
      return await this.repository.updateUser(id, data);
    } catch (error: unknown) {
      const message = error instanceof Error
        ? error.message
        : '수정 중 오류가 발생했습니다';
      throw new Error(message);
    }
  }
}
