import type { FontAsset } from '@/domain/entities/FontEntity';

// Tenant font library (`/api/admin/fonts`) — shared by the thumbnail and detail
// template editors, ADMIN-only. Delete is backend-only (no UI yet).
export interface FontRepository {
  list(): Promise<FontAsset[]>;
  upload(file: File): Promise<FontAsset>;
}
