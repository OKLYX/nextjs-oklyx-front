import type {
  ChannelProductDetail,
  ChannelProductSearch,
} from '@/domain/entities/ChannelProductEntity';

/**
 * 마켓 상품 읽기 창구(FEATURE_2609_67). 읽기 전용이고 저장이 없다.
 *
 * 응답은 Impl 에서 `ResponseDTO<T>`(`response.data.data`)를 벗겨 넘긴다.
 * ⚠️ `name` 은 20자까지다(쿠팡 제한) — 잘라 보내지 말고 입력 자체를 막는다(화면 책임).
 */
export interface ChannelProductRepository {
  /** 이름 검색. `nextToken` 을 넘기면 이어보기. 응답의 `nextToken` 이 null 이면 마지막 페이지다. */
  search(
    sellerId: number,
    platform: string,
    name: string,
    nextToken?: string,
  ): Promise<ChannelProductSearch>;
  /** 단건 조회 — 사진·옵션·속성·고시. */
  detail(
    sellerId: number,
    platform: string,
    platformProductId: string,
  ): Promise<ChannelProductDetail>;
}
