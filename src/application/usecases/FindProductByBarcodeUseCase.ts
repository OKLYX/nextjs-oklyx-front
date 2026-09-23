import type { Product } from '@/domain/entities/Product';
import type { ProductRepository } from '@/domain/repositories/ProductRepository';

/** 한 번에 받아 오는 쪽수. 목록 응답이 가벼워(물품 한 줄) 큰 값이 왕복을 줄인다. */
const PAGE_SIZE = 200;
/** 훑을 쪽수 상한 — 못 찾으면 「없습니다」로 끝낸다. 무한 루프 방지용 그물이다. */
const MAX_PAGES = 30;

/**
 * 바코드로 물품 한 건 찾기 (FEATURE_2609_69 / B — 병합 화면의 상대 물품 찾기).
 *
 * 🔴 **바코드로 물품을 돌려주는 서버 창구가 없다.** 있는 것은 두 개뿐이다:
 * - `GET /api/products/check-barcode` → 있다/없다(`exists`)만 준다. id 가 없다.
 * - `GET /api/products?search=` → **상품명 · 브랜드 · 설명 · 물품ID(완전일치)** 를 본다
 *   (`ProductRepository.searchByKeyword`). **바코드는 여전히 검색어에 걸리지 않는다.**
 *
 * 그래서 목록을 쪽 단위로 받아 `barcodeId` 가 정확히 같은 물품을 화면에서 고른다. 병합 화면은
 * 관리자가 이따금 쓰는 화면이고 찾는 즉시 멈추므로 이 방식으로 충분하다.
 * ⚠️ 이 훑기를 목록 화면·스캔 경로에 복사해 쓰지 말 것 — 그쪽은 왕복이 잦아 서버 창구가 필요하다.
 */
export class FindProductByBarcodeUseCase {
  constructor(private repository: ProductRepository) {}

  /**
   * @param barcodeId 찾을 바코드(정확히 일치)
   * @param excludeProductId 이미 화면에 있는 물품 — 자기 자신을 상대로 고를 수 없다
   * @returns 찾은 물품, 없으면 null
   */
  async execute(barcodeId: string, excludeProductId: number): Promise<Product | null> {
    const wanted = barcodeId.trim();
    if (!wanted) return null;

    for (let page = 0; page < MAX_PAGES; page += 1) {
      const result = await this.repository.getProducts({ page, size: PAGE_SIZE });
      const found = result.content.find(
        (product) => product.id !== excludeProductId && (product.barcodeId ?? '').trim() === wanted
      );
      if (found) return found;
      if (result.last || result.content.length === 0) break;
    }
    return null;
  }
}
