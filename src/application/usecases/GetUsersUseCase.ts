import type { GetUsersParams, GetUsersResponse, UserRepository } from '@/domain/repositories/UserRepository';

export class GetUsersUseCase {
  constructor(private repository: UserRepository) {}

  async getUsers(params: GetUsersParams): Promise<GetUsersResponse> {
    return this.repository.getUsers(params);
  }
}
