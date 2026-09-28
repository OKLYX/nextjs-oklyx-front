import type { InternalStage, OrderStatus } from '@/domain/entities/OrderEntity';

export interface FailedBox {
  shipmentBoxId: string;
  resultCode: string;
  message: string;
}

// An order excluded from the send. `status` = the neutral status used for the decision
// (SHIPPED etc.) — the Korean label is resolved at render time.
export interface SkippedOrder {
  orderId: string;
  status: OrderStatus;
}

export interface ShipmentConfirmResult {
  totalRows: number;
  matchedOrders: number;      // orders confirmed as send targets (skipped ones excluded)
  unmatched: string[];
  succeeded: number;
  failed: FailedBox[];
  // Optional on purpose: the UI can ship before the backend reaches dev, and then the field is
  // simply absent. Declaring it required would make the `?? []` fallback a lie the checker can't catch.
  skipped?: SkippedOrder[];
}

// V2 preview row — server(01_BACKEND) issues `rowKey` (line-unique, do NOT regenerate on client).
// Full row is held in component state; the table renders an abbreviated subset only.
export interface ShippingLabelPreviewRow {
  rowKey: string;
  receiverName: string;
  receiverPhone: string;
  postCode: string;
  address: string;
  productName: string;
  quantity: number;
  parcelQuantity: number;
  vendorItemId: string;
  orderId: string;
  deliveryMessage: string;
  shipmentBoxId: string;
  sellerName: string;
  platform: string;
}

// Same fields as PreviewRow (edited parcelQuantity included) — posted back for xlsx export.
export type ShippingLabelExportRow = ShippingLabelPreviewRow;

// --- Manual single-box shipment (PLAN 2609_11) ---

// Carrier dropdown item. The identifier IS the marketplace code — Coupang has no carrier-list API,
// so the dropdown is its documented code table and most carriers have no local `carrier` row to
// hang an id on (D2 revised 2026-09-03). The server whitelists whatever code comes back.
// `registered` = 택배사 관리에 등록해 둔 코드 (목록 맨 위로 올린다).
export interface CarrierOption {
  deliveryCompanyCode: string;
  carrierName: string;
  registered: boolean;
}

export interface ManualShipmentRequest {
  orderItemId: number;
  deliveryCompanyCode: string;
  invoiceNumber: string;
}

// `mode` is decided by the server from the order status (D3) — the client only reports it.
// `resultStatus` is the neutral 'SHIPPED' after a successful CREATE, null otherwise.
export interface ManualShipmentResult {
  orderId: string;
  shipmentBoxId: string;
  mode: 'CREATE' | 'UPDATE';
  sentLines: number;
  succeeded: number;
  failed: FailedBox[];
  resultStatus: OrderStatus | null;
}

// --- Reserved shipment (FEATURE_2609_75) ---

export type ReservedShipmentStatus = 'SCHEDULED' | 'RUNNING' | 'DONE' | 'STOPPED' | 'CANCELLED';
export type ReservedItemResult = 'PENDING' | 'SUCCEEDED' | 'FAILED' | 'CANCELLED' | 'EXTERNAL' | 'RELEASED';

/** [예약 발송] 결과 (POST /api/admin/reserved-shipments). 시각은 KST 벽시계 문자열 — Date 로 바꾸지 않는다. */
export interface ReservationCreateResult {
  reservationId: number | null;
  executeAt: string;
  reservedShipments: number;
  updatedInvoices: number;
  excluded: { orderId: string; reason: string }[];
}

/**
 * 예약 발송 현황 1행 = 주문(배송 묶음) 1개 (GET /api/admin/reserved-shipments · /orders/{externalOrderId}, D30).
 * `id` = 결과 행 id — 행 작업(시각 변경·다시 시도)의 경로 변수. `orderShipmentId` = [송장 수정] 경로 변수(D18).
 * `orderItemIds` = [예약 취소] 입력. `status` = 그 행이 속한 예약의 상태. 시각은 KST 벽시계 문자열 — Date 로 바꾸지 않는다.
 */
export interface ReservedShipmentRow {
  id: number;
  orderShipmentId: number;
  externalOrderId: string;
  externalShipmentId: string;
  orderItemIds: number[];
  executeAt: string;
  lastRunAt: string | null;
  status: ReservedShipmentStatus;
  firstRunKind: 'ON_TIME' | 'DELAYED' | null;
  carrierCode: string;
  invoiceNumber: string | null;
  result: ReservedItemResult;
  failureReason: string | null;
}

/** 「내부 상품준비중」 접수시트 미리보기 (GET /api/admin/shipping-labels/v2/preview/internal, D26). */
export interface InternalLabelPreview {
  rows: ShippingLabelPreviewRow[];
  notAcceptedOrderIds: string[];
}

/**
 * 내부 단계 배송 묶음 1개의 현재 송장 (GET /api/admin/reserved-shipments/orders/{externalOrderId}/invoices ·
 * PUT /api/admin/reserved-shipments/shipments/{orderShipmentId}/invoice, D18). 송장이 없으면 carrierCode·invoiceNumber 가 null.
 */
export interface StoredInvoice {
  orderShipmentId: number;
  externalShipmentId: string;
  internalStage: InternalStage;
  carrierCode: string | null;
  invoiceNumber: string | null;
}
