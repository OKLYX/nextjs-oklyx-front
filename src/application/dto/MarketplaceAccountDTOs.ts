import { z } from 'zod';

// FEATURE_2610_13 / D5: an 11st account has one credential field (「API 키」); the Coupang fields
// (vendorId · accessKey · secretKey) are required only when the platform is not ELEVENST.
const ELEVENST = 'ELEVENST';
const API_KEY_REQUIRED_MESSAGE = '11번가 API 키를 입력하세요.';

export const createMarketplaceAccountSchema = z
  .object({
    platform: z.string()
      .min(1, '플랫폼을 입력하세요')
      .max(50, '플랫폼은 50자 이하여야 합니다'),
    accountAlias: z.string()
      .max(100, '계정 별칭은 100자 이하여야 합니다')
      .optional(),
    vendorId: z.string()
      .max(100, '판매자(벤더) ID는 100자 이하여야 합니다')
      .optional(),
    // WING 로그인 ID (쿠팡 상품등록 필수). optional — 미설정 허용.
    vendorUserId: z.string()
      .max(100, 'WING 로그인 ID는 100자 이하여야 합니다')
      .optional(),
    accessKey: z.string()
      .max(255, 'Access Key는 255자 이하여야 합니다')
      .optional(),
    secretKey: z.string()
      .max(255, 'Secret Key는 255자 이하여야 합니다')
      .optional(),
    apiKey: z.string()
      .max(255, 'API 키는 255자 이하여야 합니다')
      .optional(),
    // native <select> value is a string; converted to Number at the submit boundary.
    // '' = unassigned = tenant-default fallback.
    thumbnailTemplateId: z.string().optional(),
    detailTemplateId: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.platform === ELEVENST) {
      if (!data.apiKey?.trim()) {
        ctx.addIssue({ code: 'custom', path: ['apiKey'], message: API_KEY_REQUIRED_MESSAGE });
      }
      return;
    }
    if (!data.vendorId?.trim()) {
      ctx.addIssue({ code: 'custom', path: ['vendorId'], message: '판매자(벤더) ID를 입력하세요' });
    }
    if (!data.accessKey?.trim()) {
      ctx.addIssue({ code: 'custom', path: ['accessKey'], message: 'Access Key를 입력하세요' });
    }
    if (!data.secretKey?.trim()) {
      ctx.addIssue({ code: 'custom', path: ['secretKey'], message: 'Secret Key를 입력하세요' });
    }
  });

export type CreateMarketplaceAccountForm = z.infer<typeof createMarketplaceAccountSchema>;

// Update form: secretKey and apiKey are optional — leave blank to keep the existing key
// (the GET response never returns either key, so they cannot be pre-filled).
export const updateMarketplaceAccountSchema = z
  .object({
    platform: z.string()
      .min(1, '플랫폼을 입력하세요')
      .max(50, '플랫폼은 50자 이하여야 합니다'),
    accountAlias: z.string()
      .max(100, '계정 별칭은 100자 이하여야 합니다')
      .optional(),
    vendorId: z.string()
      .max(100, '판매자(벤더) ID는 100자 이하여야 합니다')
      .optional(),
    // WING 로그인 ID (쿠팡 상품등록 필수). optional — 미설정 허용.
    vendorUserId: z.string()
      .max(100, 'WING 로그인 ID는 100자 이하여야 합니다')
      .optional(),
    accessKey: z.string()
      .max(255, 'Access Key는 255자 이하여야 합니다')
      .optional(),
    secretKey: z.string()
      .max(255, 'Secret Key는 255자 이하여야 합니다')
      .optional(),
    apiKey: z.string()
      .max(255, 'API 키는 255자 이하여야 합니다')
      .optional(),
    // '' = keep existing assignment (no clearing to default); a value = replace.
    thumbnailTemplateId: z.string().optional(),
    detailTemplateId: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.platform === ELEVENST) return;
    if (!data.vendorId?.trim()) {
      ctx.addIssue({ code: 'custom', path: ['vendorId'], message: '판매자(벤더) ID를 입력하세요' });
    }
    if (!data.accessKey?.trim()) {
      ctx.addIssue({ code: 'custom', path: ['accessKey'], message: 'Access Key를 입력하세요' });
    }
  });

export type UpdateMarketplaceAccountForm = z.infer<typeof updateMarketplaceAccountSchema>;
