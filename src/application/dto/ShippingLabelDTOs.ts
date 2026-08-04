export interface FailedBox {
  shipmentBoxId: string;
  resultCode: string;
  message: string;
}

export interface ShipmentConfirmResult {
  totalRows: number;
  matchedOrders: number;
  unmatched: string[];
  succeeded: number;
  failed: FailedBox[];
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
