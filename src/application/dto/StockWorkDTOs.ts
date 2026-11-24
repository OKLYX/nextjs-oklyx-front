import type { StockReason } from '@/domain/entities/StockEntity';

/**
 * Request bodies of FEATURE_2611_34 (stock work screens).
 */

/**
 * 「출고 작업」 save (FEATURE_2611_34 D34 · D35 ⑤): every line of one tab, one request. `reason` = a disposal reason
 * (「폐기」 tab) or SUPPLIER_RETURN (「매입처 반품」 tab); `reasonNote` only on an ETC line (R25).
 */
export interface OutboundWorkRequest {
  movedOn: string;
  lines: { productId: number; sellerId: number; reason: StockReason; reasonNote?: string; quantity: number }[];
}
