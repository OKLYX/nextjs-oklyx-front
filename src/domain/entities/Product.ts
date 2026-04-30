export interface Product {
  id: number;
  productName: string;
  brand: string;
  price: number;
  store: string;
  active: boolean;
  createdDate: string;
  modifiedDate?: string;
  barcodeId?: string;
  unit?: string;
  volumeHeight?: number;
  volumeLong?: number;
  volumeShort?: number;
  weight?: number;
  description?: string;
  name?: string;
  imageUrl?: string;
}
