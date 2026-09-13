import type { BoxKind, Package } from '@/domain/entities/PackageEntity';
import type { CreatePackageRequest } from '@/application/dto/CreatePackageRequest';
import type { UpdatePackageRequest } from '@/application/dto/UpdatePackageRequest';

export interface PackageRepository {
  /**
   * 상자 목록. 🔴 판매가 계산용 호출부는 반드시 `'PURCHASED'` 를 넘긴다(PLAN 2609_40 D21) —
   * 넘기지 않으면 비용 0 인 재활용 상자가 후보에 섞여 원가 0 으로 판매가가 계산된다.
   * 생략 = 전 유형(상자 관리·포장 화면).
   */
  getPackages(boxKind?: BoxKind): Promise<Package[]>;

  createPackage(data: CreatePackageRequest): Promise<Package>;

  updatePackage(id: number, data: UpdatePackageRequest): Promise<Package>;

  /** 상자 사진 업로드(multipart). 응답은 `imageUrl` 이 채워진 상자 */
  uploadPackageImage(id: number, file: File): Promise<Package>;

  deletePackage(id: number): Promise<void>;
}
