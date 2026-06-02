import { SellerRepository, CreateSellerRequest, UpdateSellerRequest, SellerPageResponse } from '@/domain/repositories/SellerRepository';
import { Seller } from '@/domain/entities/SellerEntity';

export class SellerUseCase {
  constructor(private repository: SellerRepository) {}

  async getAll(): Promise<Seller[]> {
    return this.repository.getAll();
  }

  async getById(id: number): Promise<Seller> {
    return this.repository.getById(id);
  }

  async getAllPaginated(name: string, page: number, size: number = 20): Promise<SellerPageResponse> {
    return this.repository.getAllPaginated(name, page, size);
  }

  async create(data: CreateSellerRequest): Promise<Seller> {
    return this.repository.create(data);
  }

  async update(id: number, data: UpdateSellerRequest): Promise<Seller> {
    return this.repository.update(id, data);
  }

  async delete(id: number): Promise<void> {
    return this.repository.delete(id);
  }
}
