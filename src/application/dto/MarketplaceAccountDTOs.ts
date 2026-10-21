import { z } from 'zod';

// FEATURE_2610_13 / D5 · FEATURE_2610_26 / D4 · D5 · D40: each marketplace has its own credential fields — 11st
// 「API 키」 alone, ESM the master ID · secret key · two seller IDs, and the Coupang fields (vendorId · accessKey ·
// secretKey) for every other platform as before.
const ELEVENST = 'ELEVENST';
const ESM = 'ESM';
const API_KEY_REQUIRED_MESSAGE = '11번가 API 키를 입력하세요.';
const ESM_MASTER_ID_REQUIRED_MESSAGE = 'ESM+ 마스터 ID 를 입력하세요.';
const ESM_SECRET_KEY_REQUIRED_MESSAGE = '비밀키를 입력하세요.';
const ESM_SELLER_IDS_REQUIRED_MESSAGE = 'G마켓 판매자 ID 와 옥션 판매자 ID 를 모두 입력하세요';

type EsmFields = {
  esmMasterId?: string;
  esmSecretKey?: string;
  gmarketSellerId?: string;
  auctionSellerId?: string;
};

/** FEATURE_2610_26 / D4 · D5: the ESM values — all four on create, the secret may stay blank on update (keep). */
function addEsmIssues(data: EsmFields, ctx: z.RefinementCtx, secretRequired: boolean) {
  if (!data.esmMasterId?.trim()) {
    ctx.addIssue({ code: 'custom', path: ['esmMasterId'], message: ESM_MASTER_ID_REQUIRED_MESSAGE });
  }
  if (secretRequired && !data.esmSecretKey?.trim()) {
    ctx.addIssue({ code: 'custom', path: ['esmSecretKey'], message: ESM_SECRET_KEY_REQUIRED_MESSAGE });
  }
  if (!data.gmarketSellerId?.trim()) {
    ctx.addIssue({ code: 'custom', path: ['gmarketSellerId'], message: ESM_SELLER_IDS_REQUIRED_MESSAGE });
  }
  if (!data.auctionSellerId?.trim()) {
    ctx.addIssue({ code: 'custom', path: ['auctionSellerId'], message: ESM_SELLER_IDS_REQUIRED_MESSAGE });
  }
}

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
    esmMasterId: z.string()
      .max(100, 'ESM+ 마스터 ID는 100자 이하여야 합니다')
      .optional(),
    esmSecretKey: z.string()
      .max(255, '비밀키는 255자 이하여야 합니다')
      .optional(),
    gmarketSellerId: z.string()
      .max(100, 'G마켓 판매자 ID는 100자 이하여야 합니다')
      .optional(),
    auctionSellerId: z.string()
      .max(100, '옥션 판매자 ID는 100자 이하여야 합니다')
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
    if (data.platform === ESM) {
      addEsmIssues(data, ctx, true);
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

// Update form: secretKey, apiKey and esmSecretKey are optional — leave blank to keep the existing key
// (the GET response never returns a key, so they cannot be pre-filled).
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
    esmMasterId: z.string()
      .max(100, 'ESM+ 마스터 ID는 100자 이하여야 합니다')
      .optional(),
    esmSecretKey: z.string()
      .max(255, '비밀키는 255자 이하여야 합니다')
      .optional(),
    gmarketSellerId: z.string()
      .max(100, 'G마켓 판매자 ID는 100자 이하여야 합니다')
      .optional(),
    auctionSellerId: z.string()
      .max(100, '옥션 판매자 ID는 100자 이하여야 합니다')
      .optional(),
    // '' = keep existing assignment (no clearing to default); a value = replace.
    thumbnailTemplateId: z.string().optional(),
    detailTemplateId: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.platform === ELEVENST) return;
    if (data.platform === ESM) {
      addEsmIssues(data, ctx, false);
      return;
    }
    if (!data.vendorId?.trim()) {
      ctx.addIssue({ code: 'custom', path: ['vendorId'], message: '판매자(벤더) ID를 입력하세요' });
    }
    if (!data.accessKey?.trim()) {
      ctx.addIssue({ code: 'custom', path: ['accessKey'], message: 'Access Key를 입력하세요' });
    }
  });

export type UpdateMarketplaceAccountForm = z.infer<typeof updateMarketplaceAccountSchema>;
