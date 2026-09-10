import type {
  AccountFixedCost,
  AccountFixedCostRequestItem,
  CreateFixedCostRequest,
  PlatformFixedCost,
  UpdateFixedCostRequest,
} from '@/domain/entities/FixedCost';

/**
 * 고정비 카탈로그 + 채널 연결 (FEATURE_2609_33 / 백엔드 `FixedCostController` SSOT).
 * 전부 ADMIN 전용 엔드포인트(`/api/admin/**`, D10).
 */
export interface FixedCostRepository {
  /** 카탈로그 전체(비활성 포함 — 화면에서 다시 켤 수 있어야 한다). */
  list(): Promise<PlatformFixedCost[]>;

  create(data: CreateFixedCostRequest): Promise<PlatformFixedCost>;

  update(id: number, data: UpdateFixedCostRequest): Promise<PlatformFixedCost>;

  /** 연결이 하나라도 있으면 409 — 그만 부과하려면 `update({active:false})` 다. */
  remove(id: number): Promise<void>;

  listForAccount(accountId: number): Promise<AccountFixedCost[]>;

  /** 🔴 멱등 replace — 보낸 목록이 그 채널의 전부다(빠진 항목은 연결이 끊긴다). */
  setForAccount(accountId: number, items: AccountFixedCostRequestItem[]): Promise<void>;
}
