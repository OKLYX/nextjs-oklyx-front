'use client';

import { axiosInstance } from '@/infrastructure/api/axiosInstance';
import type { SettlementRepository } from '@/domain/repositories/SettlementRepository';
import type {
  PayoutDetail,
  PayoutQuery,
  PayoutSummary,
  PayoutSyncResult,
  ReconLineQuery,
  ReconLineView,
  ReconReport,
  SettlementSyncResult,
  SettlementSyncTarget,
} from '@/domain/entities/Settlement';

/**
 * `/api/admin/settlement/**` 호출부 (FEATURE_2609_30 / 백엔드 01·02).
 *
 * ⚠️ 빈 값 키는 아예 보내지 않는다 — `from=` 을 보내면 서버 기본값이 아니라 400 이 된다.
 * ⚠️ 엑셀만 blob 이고 나머지는 표준 봉투다(`response.data.data` 언래핑).
 */
export class SettlementRepositoryImpl implements SettlementRepository {
  async getPayouts(query: PayoutQuery): Promise<PayoutSummary[]> {
    const params: Record<string, string | number> = {};
    if (query.sellerId != null) params.sellerId = query.sellerId;
    if (query.accountId != null) params.accountId = query.accountId;
    if (query.from) params.from = query.from;
    if (query.to) params.to = query.to;
    const response = await axiosInstance.get('/api/admin/settlement/payouts', { params });
    return response.data.data;
  }

  async getPayout(payoutId: number): Promise<PayoutDetail> {
    const response = await axiosInstance.get(`/api/admin/settlement/payouts/${payoutId}`);
    return response.data.data;
  }

  async getPayoutLines(payoutId: number, query: ReconLineQuery): Promise<ReconLineView[]> {
    const params: Record<string, string | boolean> = {};
    if (query.label) params.label = query.label;
    if (query.unmatched != null) params.unmatched = query.unmatched;
    const response = await axiosInstance.get(`/api/admin/settlement/payouts/${payoutId}/lines`, {
      params,
    });
    return response.data.data;
  }

  async getReport(payoutId: number): Promise<ReconReport> {
    const response = await axiosInstance.get(`/api/admin/settlement/payouts/${payoutId}/report`);
    return response.data.data;
  }

  // xlsx 바이너리 — responseType 'blob', 언래핑 없음 (ShippingLabelRepositoryImpl 과 같은 관례).
  async exportReport(payoutId: number): Promise<Blob> {
    const response = await axiosInstance.get(`/api/admin/settlement/payouts/${payoutId}/export`, {
      responseType: 'blob',
    });
    return response.data;
  }

  // 서버 우선순위: accountId > sellerId > 전체. 최소 간격 안이면 `skipped=true` 로 돌아온다(에러 아님).
  async syncSettlement(accountId?: number, sellerId?: number): Promise<SettlementSyncResult> {
    const params: Record<string, number> = {};
    if (accountId != null) params.accountId = accountId;
    else if (sellerId != null) params.sellerId = sellerId;
    const response = await axiosInstance.post('/api/admin/settlement/sync', null, { params });
    return response.data.data;
  }

  // `month` 를 보내지 않으면 서버가 계정별로 대상 월을 정한다(최초면 백필, 아니면 당월+직전월).
  // `month`('yyyy-MM')를 보내면 그 달만 읽고 앵커를 갱신하지 않는다(PLAN 2609_31 D3).
  async syncPayouts(accountId?: number, month?: string): Promise<PayoutSyncResult> {
    const params: Record<string, number | string> = {};
    if (accountId != null) params.accountId = accountId;
    if (month) params.month = month;
    const response = await axiosInstance.post('/api/admin/settlement/payout/sync', null, { params });
    return response.data.data;
  }

  // 매출내역(정산 라인) 기간 백필 — 계정 1건 · 한 달. 서버가 31일 초과 구간을 어댑터에서 자르지만
  // 호출부가 월 단위로 쪼개 보낸다(PLAN 2609_31 D5).
  async syncRevenuePeriod(
    accountId: number,
    from: string,
    to: string
  ): Promise<SettlementSyncResult> {
    const response = await axiosInstance.post('/api/admin/settlement/sync/period', null, {
      params: { accountId, from, to },
    });
    return response.data.data;
  }

  async getSyncTargets(sellerId?: number): Promise<SettlementSyncTarget[]> {
    const response = await axiosInstance.get('/api/admin/settlement/sync/targets', {
      params: sellerId != null ? { sellerId } : undefined,
    });
    return response.data.data;
  }
}
