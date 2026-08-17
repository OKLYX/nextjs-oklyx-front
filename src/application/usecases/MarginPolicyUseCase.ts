import type { MarginPolicyRepository } from '@/domain/repositories/MarginPolicyRepository';
import type {
  MarginPolicyResponse,
  MarginPolicyRequest,
} from '@/domain/entities/MarginPolicyEntity';

export class MarginPolicyUseCase {
  constructor(private repository: MarginPolicyRepository) {}

  list(): Promise<MarginPolicyResponse[]> {
    return this.repository.list();
  }

  getById(id: number): Promise<MarginPolicyResponse> {
    return this.repository.getById(id);
  }

  create(data: MarginPolicyRequest): Promise<MarginPolicyResponse> {
    return this.repository.create(data);
  }

  update(id: number, data: MarginPolicyRequest): Promise<MarginPolicyResponse> {
    return this.repository.update(id, data);
  }

  remove(id: number): Promise<void> {
    return this.repository.remove(id);
  }
}
