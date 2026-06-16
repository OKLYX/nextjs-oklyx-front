import { z } from 'zod';

export const createMarketplaceAccountSchema = z.object({
  platform: z.string()
    .min(1, '플랫폼을 입력하세요')
    .max(50, '플랫폼은 50자 이하여야 합니다'),
  accountAlias: z.string()
    .max(100, '계정 별칭은 100자 이하여야 합니다')
    .optional(),
  vendorId: z.string()
    .min(1, '판매자(벤더) ID를 입력하세요')
    .max(100, '판매자(벤더) ID는 100자 이하여야 합니다'),
  accessKey: z.string()
    .min(1, 'Access Key를 입력하세요')
    .max(255, 'Access Key는 255자 이하여야 합니다'),
  secretKey: z.string()
    .min(1, 'Secret Key를 입력하세요')
    .max(255, 'Secret Key는 255자 이하여야 합니다'),
});

export type CreateMarketplaceAccountForm = z.infer<typeof createMarketplaceAccountSchema>;
