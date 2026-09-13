import type {
  BarcodeLookupResult,
  BoxCandidate,
  BoxCandidateItem,
  PackingCloseResult,
  PackingCompleteResult,
  PackingScanResponse,
  ParcelCompleteRequest,
  PendingParcel,
} from '@/domain/entities/PackingEntity';

/**
 * 포장 콘솔 창구 (FEATURE_2609_40 / PLAN D9 ~ D17 · D31 · D32).
 *
 * 🔴 **전체 상자 목록은 여기 없다.** 기억이 없는 조합에서 고를 전체 목록은 기존
 * `PackageUseCase.getPackages()`(04)를 **필터 없이** 부른다 — 재활용 상자도 포장에서는
 * 정상 후보다(D21 은 판매가 계산 목록만 거른다). 같은 목록에 창구를 하나 더 만들지 않는다.
 */
export interface PackingRepository {
  /** 송장번호 → 박스 + 담을 것 + 상자 후보. 못 찾으면 404 */
  scan(invoiceNumber: string): Promise<PackingScanResponse>;

  /** 작업 대상 박스 목록. 서버가 이미 잔량으로 걸러서 준다 (D31) */
  pending(sellerId?: number): Promise<PendingParcel[]>;

  /** 화면에서 못 맞춘 바코드만 물어본다 (오류 경로 전용, D11) */
  lookupBarcode(value: string, parcelId: number): Promise<BarcodeLookupResult>;

  /** 담은 조합 → 상자 후보(최대 3). 기억이 없으면 빈 목록이다 (D23) */
  boxCandidates(items: BoxCandidateItem[]): Promise<BoxCandidate[]>;

  /** [이 박스 완료] — 박스 내용 + 출고 + 절약 + 상자 기억. 멱등이다 (D15) */
  complete(parcelId: number, request: ParcelCompleteRequest): Promise<PackingCompleteResult>;

  /** 송장을 안 쓴 박스를 닫는다 — 출고·기억·절약 없음 (D32) */
  markUnused(parcelId: number): Promise<PackingCloseResult>;
}
