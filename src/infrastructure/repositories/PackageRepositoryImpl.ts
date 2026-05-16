import { axiosInstance } from '@/infrastructure/api/axiosInstance';
import type { Package } from '@/domain/entities/PackageEntity';
import type { PackageRepository } from '@/domain/repositories/PackageRepository';
import type { CreatePackageRequest } from '@/application/dto/CreatePackageRequest';
import type { UpdatePackageRequest } from '@/application/dto/UpdatePackageRequest';

export class PackageRepositoryImpl implements PackageRepository {
  async getPackages(): Promise<Package[]> {
    const response = await axiosInstance.get('/api/admin/package');
    return response.data.data;
  }

  async createPackage(data: CreatePackageRequest): Promise<Package> {
    const response = await axiosInstance.post('/api/admin/package', data);
    return response.data.data;
  }

  async updatePackage(
    id: number,
    data: UpdatePackageRequest
  ): Promise<Package> {
    const response = await axiosInstance.patch(`/api/admin/package/${id}`, data);
    return response.data.data;
  }
}
