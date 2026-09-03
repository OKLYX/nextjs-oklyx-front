export interface FailedBox {
  shipmentBoxId: string;
  resultCode: string;
  message: string;
}

// An order excluded from the send. `status` = the raw Coupang code used for the decision
// (DEPARTURE etc.) — the Korean label is resolved at render time.
export interface SkippedOrder {
  orderId: string;
  status: string;
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
