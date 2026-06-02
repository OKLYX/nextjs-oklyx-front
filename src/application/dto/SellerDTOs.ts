import { z } from 'zod';

export const createSellerSchema = z.object({
  sellerName: z.string()
    .min(2, '판매자명은 2자 이상이어야 합니다')
    .max(255, '판매자명은 255자 이하여야 합니다'),
  businessRegistration: z.string()
    .min(5, '사업자등록번호는 5자 이상이어야 합니다')
    .max(50, '사업자등록번호는 50자 이하여야 합니다'),
});

export type CreateSellerRequest = z.infer<typeof createSellerSchema>;

export interface UpdateSellerRequest {
  sellerName?: string;
  businessRegistration?: string;
}
