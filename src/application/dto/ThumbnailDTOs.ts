import type { BackgroundMode, TemplateElement } from '@/domain/entities/ThumbnailEntity';

// Request DTO = ThumbnailTemplate minus server-generated fields (id).
// Exact field/required rules follow the backend (01) contract.
export interface ThumbnailTemplateRequest {
  name: string;
  canvasWidth: number;
  canvasHeight: number;
  backgroundMode: BackgroundMode;
  gradientTopColor: string | null; // sent only when backgroundMode === 'GRADIENT_MANUAL', else null
  gradientBottomColor: string | null;
  elements: TemplateElement[];
  active: boolean;
  isDefault: boolean;
}

// Preview: send the current (possibly unsaved) template inline + sample text
// bindings. Backend renders and returns an image/jpeg blob (non-persistent).
export interface ThumbnailPreviewRequest {
  templateId?: number;
  template?: ThumbnailTemplateRequest;
  sampleBindings: Record<string, string>;
}
