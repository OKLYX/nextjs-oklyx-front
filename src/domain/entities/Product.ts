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
  volumeHeight?: string;
  volumeLong?: string;
  volumeShort?: string;
  weight?: string;
  description?: string;
  name?: string;
  imageUrl?: string;
}
