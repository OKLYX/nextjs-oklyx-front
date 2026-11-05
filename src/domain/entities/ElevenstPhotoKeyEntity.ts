/**
 * The company's 11st photo lookup key state (FEATURE_2611_11 / D39). The key itself is never returned —
 * `configured` only says whether one is stored (「입력됨」 / 「비어 있음」).
 */
export interface ElevenstPhotoKey {
  configured: boolean;
}

/** PUT body — a blank `apiKey` clears the stored key. */
export interface ElevenstPhotoKeyUpdateRequest {
  apiKey: string;
}
