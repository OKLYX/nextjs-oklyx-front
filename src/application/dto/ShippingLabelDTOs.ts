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
