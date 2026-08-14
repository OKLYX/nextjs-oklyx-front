import type { BackgroundMode, TemplateElement, TemplateField } from '@/domain/entities/ThumbnailEntity';

// Request DTO = ThumbnailTemplate minus server-generated fields (id).
// Exact field/required rules follow the backend (01) contract.
export interface ThumbnailTemplateRequest {
  name: string;
  canvasWidth: number;
  canvasHeight: number;
  backgroundMode: BackgroundMode;
  gradientTopColor: string | null; // sent only when backgroundMode === 'GRADIENT_MANUAL', else null
  gradientBottomColor: string | null;
  fields: TemplateField[];
  elements: TemplateElement[];
  active: boolean;
  isDefault: boolean;
}

// Generate a product thumbnail with per-field values resolved on the UI
// (reserved keys auto-filled from product, custom keys from defaults, both
// user-adjustable). Sent as the body of POST .../generate.
export interface GenerateThumbnailRequest {
  fieldValues: Record<string, string>;
}

// Preview: send the current (possibly unsaved) template inline + sample text
// bindings. Backend renders and returns an image/jpeg blob (non-persistent).
export interface ThumbnailPreviewRequest {
  templateId?: number;
  template?: ThumbnailTemplateRequest;
  sampleBindings: Record<string, string>;
}
