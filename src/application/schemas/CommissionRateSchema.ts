import { z } from 'zod';

export const createCommissionRateSchema = z.object({
  platform: z.string()
    .min(1, { message: '플랫폼은 필수입니다' })
    .max(50),
  categoryId: z.number()
    .min(1, { message: '카테고리는 필수입니다' }),
  rate: z.number()
    .min(0, { message: '수수료율은 0 이상이어야 합니다' })
    .max(1, { message: '수수료율은 1 이하여야 합니다' }),
});

export type CreateCommissionRateFormData = z.infer<typeof createCommissionRateSchema>;
