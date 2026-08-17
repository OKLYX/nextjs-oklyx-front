import type {
  MarginPolicyResponse,
  MarginPolicyRequest,
} from '@/domain/entities/MarginPolicyEntity';

export interface MarginPolicyRepository {
  list(): Promise<MarginPolicyResponse[]>;
  getById(id: number): Promise<MarginPolicyResponse>;
  create(data: MarginPolicyRequest): Promise<MarginPolicyResponse>;
  update(id: number, data: MarginPolicyRequest): Promise<MarginPolicyResponse>;
  remove(id: number): Promise<void>;
}
