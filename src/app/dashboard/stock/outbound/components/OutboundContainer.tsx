'use client';

import { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { PageContainer } from '@/presentation/components/PageContainer';
import { StockRepositoryImpl } from '@/infrastructure/repositories/StockRepositoryImpl';
import { StockUseCase } from '@/application/usecases/StockUseCase';
import { SellerRepositoryImpl } from '@/infrastructure/repositories/SellerRepositoryImpl';
import { SellerUseCase } from '@/application/usecases/SellerUseCase';
import type { Seller } from '@/domain/entities/SellerEntity';
import type { OutboundOrder, OutboundUnexpanded } from '@/domain/entities/StockEntity';
import { SHIPMENT_STATUSES, getOrderStatusLabel } from '@/domain/entities/OrderEntity';
import { OutboundOrderCard } from './OutboundOrderCard';
import { OutboundUnexpandedSection } from './OutboundUnexpandedSection';
import { Card } from '@/presentation/components/ui/Card';
import { StateBlock } from '@/presentation/components/ui/StateBlock';

// 로컬 타임존 기준 오늘(YYYY-MM-DD). toISOString(UTC)은 KST에서 하루 어긋날 수 있어 직접 조립.
const today = () => {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
};

/**
 * 출고 확인 화면 (FEATURE_2609_28 / PLAN D11·D12).
 *
 * ⚠️ 출고는 주문에서 출발한다 — 상품 검색으로 시작하는 입구를 만들지 않는다(D11).
 * ⚠️ 확인 성공 시 그 줄의 수치만 갱신한다. 전체 재조회는 작업 흐름을 끊는다.
 */
export function OutboundContainer() {
  const stockUseCase = useMemo(() => new StockUseCase(new StockRepositoryImpl()), []);
  const sellerUseCase = useMemo(() => new SellerUseCase(new SellerRepositoryImpl()), []);

  const [sellers, setSellers] = useState<Seller[]>([]);
  const [sellerId, setSellerId] = useState('');
  const [status, setStatus] = useState('');
  const [orders, setOrders] = useState<OutboundOrder[]>([]);
  const [unexpanded, setUnexpanded] = useState<OutboundUnexpanded[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const [errorKey, setErrorKey] = useState<string | null>(null);
  const [confirmError, setConfirmError] = useState('');

  const load = async (nextSellerId: string = sellerId, nextStatus: string = status) => {
    setIsLoading(true);
    setError('');
    try {
      const result = await stockUseCase.getOutbound(
        nextSellerId ? Number(nextSellerId) : undefined,
        nextStatus || undefined
      );
      setOrders(result.orders);
      setUnexpanded(result.unexpanded);
    } catch {
      setError('출고 대상 조회에 실패했습니다.');
      setOrders([]);
      setUnexpanded([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const init = async () => {
      try {
        setSellers(await sellerUseCase.getAll());
      } catch {
        setSellers([]);
      }
      await load();
    };
    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleFilterChange = (nextSellerId: string, nextStatus: string) => {
    setSellerId(nextSellerId);
    setStatus(nextStatus);
    load(nextSellerId, nextStatus);
  };

  // 확인 1건 = 요청 1번(D12). lines 는 한 건짜리다.
  const handleConfirm = async (orderLineId: number, productId: number, quantity: number) => {
    const key = `${orderLineId}:${productId}`;
    setPendingKey(key);
    setErrorKey(null);
    setConfirmError('');
    try {
      await stockUseCase.confirmOutbound({
        orderLineId,
        lines: [{ productId, quantity }],
        movedOn: today(),
      });
      // 그 줄의 확인 수치만 올린다. 전량 확인된 주문은 목록에서 빠진다(서버 규칙과 같다).
      setOrders((prev) =>
        prev
          .map((order) =>
            order.orderLineId !== orderLineId
              ? order
              : {
                  ...order,
                  products: order.products.map((product) =>
                    product.productId !== productId
                      ? product
                      : { ...product, confirmedQty: product.confirmedQty + quantity }
                  ),
                }
          )
          .filter((order) =>
            order.products.some((product) => product.requiredQty - product.confirmedQty > 0)
          )
      );
    } catch (err) {
      // 수량 초과·전개 불가 판정은 서버가 한다 — 메시지를 원문 그대로 보여준다.
      const serverMessage = axios.isAxiosError(err) ? err.response?.data?.message : undefined;
      setErrorKey(key);
      setConfirmError(serverMessage || '출고 확인에 실패했습니다.');
    } finally {
      setPendingKey(null);
    }
  };

  return (
    <PageContainer>
      <div className="bg-white rounded-lg shadow p-4 flex flex-wrap items-end gap-3">
        <div>
          <label className="block text-xs text-gray-500 mb-1">판매자</label>
          <select
            value={sellerId}
            onChange={(e) => handleFilterChange(e.target.value, status)}
            className="px-2 py-1 border border-gray-300 rounded text-sm bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="">전체</option>
            {sellers.map((seller) => (
              <option key={seller.id} value={seller.id}>
                {seller.sellerName}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs text-gray-500 mb-1">상태</label>
          <select
            value={status}
            onChange={(e) => handleFilterChange(sellerId, e.target.value)}
            className="px-2 py-1 border border-gray-300 rounded text-sm bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="">전체</option>
            {SHIPMENT_STATUSES.map((value) => (
              <option key={value} value={value}>
                {getOrderStatusLabel(value)}
              </option>
            ))}
          </select>
        </div>

        <button
          type="button"
          onClick={() => load()}
          disabled={isLoading}
          className="px-3 py-1.5 text-sm border border-gray-300 rounded hover:bg-gray-100 disabled:opacity-50"
        >
          {isLoading ? '조회 중...' : '새로고침'}
        </button>
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
          {error}
        </div>
      )}

      {isLoading ? (
        <div className="space-y-3">
          {[0, 1, 2].map((row) => (
            <div key={row} className="h-24 bg-gray-100 rounded-lg animate-pulse" />
          ))}
        </div>
      ) : orders.length === 0 ? (
        <Card padded={false}>
          <StateBlock variant="empty" message="출고를 기다리는 주문이 없습니다." />
        </Card>
      ) : (
        orders.map((order) => (
          <OutboundOrderCard
            key={order.orderLineId}
            order={order}
            pendingKey={pendingKey}
            errorKey={errorKey}
            errorMessage={confirmError}
            onConfirm={handleConfirm}
          />
        ))
      )}

      <OutboundUnexpandedSection items={unexpanded} />
    </PageContainer>
  );
}
