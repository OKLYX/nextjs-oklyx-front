/** Register a card (FEATURE_2610_18 D52). The server rejects 13 or more digits in a row (D92). */
export interface CreateSellerCardRequest {
  sellerId: number;
  alias: string;
  maskedNumber: string;
}

/** Edit a card — alias and masked number only, the owner seller stays (D91). */
export interface UpdateSellerCardRequest {
  alias: string;
  maskedNumber: string;
}
