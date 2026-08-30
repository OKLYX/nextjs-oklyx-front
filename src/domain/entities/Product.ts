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
  netContentUnit?: string;
  packageHeight?: string;
  packageLength?: string;
  packageWidth?: string;
  netContent?: string;
  description?: string;
  name?: string;
  imageUrl?: string;
}
