import type { Package } from '@/domain/entities/PackageEntity';
import type { PackageRepository } from '@/domain/repositories/PackageRepository';
import type { CreatePackageRequest } from '@/application/dto/CreatePackageRequest';
import type { UpdatePackageRequest } from '@/application/dto/UpdatePackageRequest';

export class PackageUseCase {
  constructor(private repository: PackageRepository) {}

  async getPackages(): Promise<Package[]> {
    return this.repository.getPackages();
  }

  async createPackage(data: CreatePackageRequest): Promise<Package> {
    return this.repository.createPackage(data);
  }

  async updatePackage(id: number, data: UpdatePackageRequest): Promise<Package> {
    return this.repository.updatePackage(id, data);
  }
}
