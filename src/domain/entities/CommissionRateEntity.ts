export interface CommissionRate {
  id: number;
  platform: string;
  categoryId: number | null;
  rate: number;
}
