import type { BoxKind, Package } from '@/domain/entities/PackageEntity';
import type { PackageRepository } from '@/domain/repositories/PackageRepository';
import type { CreatePackageRequest } from '@/application/dto/CreatePackageRequest';
import type { UpdatePackageRequest } from '@/application/dto/UpdatePackageRequest';

export class PackageUseCase {
  constructor(private repository: PackageRepository) {}

  /** 🔴 판매가 계산용 화면은 `'PURCHASED'` 를 넘긴다(PLAN 2609_40 D21). 생략 = 전 유형 */
  async getPackages(boxKind?: BoxKind): Promise<Package[]> {
    return this.repository.getPackages(boxKind);
  }

  async createPackage(data: CreatePackageRequest): Promise<Package> {
    return this.repository.createPackage(data);
  }

  async updatePackage(id: number, data: UpdatePackageRequest): Promise<Package> {
    return this.repository.updatePackage(id, data);
  }

  async uploadPackageImage(id: number, file: File): Promise<Package> {
    return this.repository.uploadPackageImage(id, file);
  }

  async deletePackage(id: number): Promise<void> {
    return this.repository.deletePackage(id);
  }
}
