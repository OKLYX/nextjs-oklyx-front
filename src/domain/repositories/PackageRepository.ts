import type { Package } from '@/domain/entities/PackageEntity';
import type { CreatePackageRequest } from '@/application/dto/CreatePackageRequest';
import type { UpdatePackageRequest } from '@/application/dto/UpdatePackageRequest';

export interface PackageRepository {
  getPackages(): Promise<Package[]>;

  createPackage(data: CreatePackageRequest): Promise<Package>;

  updatePackage(id: number, data: UpdatePackageRequest): Promise<Package>;
}
