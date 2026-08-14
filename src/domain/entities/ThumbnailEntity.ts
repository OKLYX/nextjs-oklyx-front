// Thumbnail template domain types. SSOT = backend contract (prompt 01/02).
// If the implemented API diverges, the implemented API wins.

export type ElementType = 'text' | 'image';

// A template input field. Text elements bind to a field by its key; the field's
// value is supplied at generate time (auto-filled for reserved keys, default
// value for custom keys). SSOT = backend contract (prompt 13).
export interface TemplateField {
  key: string;
  label: string;
  defaultValue: string;
}

// Reserved field keys: always present, auto-filled from the product, not deletable.
export const BUILTIN_FIELD_KEYS = ['brandName', 'productName'] as const;

// Image bind values (backend contract SSOT). Text binds are now arbitrary field
// keys (see TemplateField), so TemplateElement.bind is generalized to string | null.
export type ImageBind = 'productImage';

// Background layer paint mode. SSOT = backend enum BackgroundMode (prompt 07).
// GRADIENT_AUTO uses the product image's top/bottom average colors (gray fallback
// when no image, e.g. preview); GRADIENT_MANUAL uses the two explicit colors below.
export type BackgroundMode = 'WHITE' | 'BLACK' | 'GRAY' | 'GRADIENT_AUTO' | 'GRADIENT_MANUAL';

export interface ElementRegion {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface ElementAlign {
  h: 'left' | 'center' | 'right';
  v: 'top' | 'center' | 'bottom';
}

export interface TemplateElement {
  type: ElementType;
  bind: string | null; // text -> field key / image -> ImageBind (or null for fixed src)
  src: string | null; // image: fixed storage key
  region: ElementRegion; // canvas source coordinates (px); the text box (no padding)
  align: ElementAlign;
  fontId: number | null;
  color: string | null; // '#RRGGBB' (text fill; top color when gradientColor is set)
  gradientColor?: string | null; // text: end color of a fill gradient; null -> solid color
  gradientAngle?: number | null; // text: gradient direction in degrees, clockwise from top->bottom; null -> 0
  maxFontSize: number;
  minFontSize: number;
  maxLines: number;
  lineSpacing?: number; // text: line-height multiplier (e.g. 1.15); backend null -> 1.0
  opacity: number; // image
  outlineColor?: string | null; // text: glyph outline color '#RRGGBB'; null -> no outline
  outlineWidth?: number | null; // text: glyph outline width px; null/0 -> no outline
  borderColor?: string | null; // any element: region border color '#RRGGBB'; null -> no border
  borderWidth?: number | null; // any element: region border width px; null/0 -> no border
}

export interface ThumbnailTemplate {
  id: number;
  name: string;
  canvasWidth: number;
  canvasHeight: number;
  backgroundMode: BackgroundMode;
  gradientTopColor: string | null; // '#RRGGBB', used only when GRADIENT_MANUAL
  gradientBottomColor: string | null; // '#RRGGBB', used only when GRADIENT_MANUAL
  fields: TemplateField[]; // template input fields (reserved brandName/productName + custom)
  elements: TemplateElement[];
  active: boolean;
  isDefault: boolean; // tenant default template (only one per tenant)
}

export interface FontAsset {
  id: number;
  displayName: string;
  familyKey: string;
  source: 'BUNDLED' | 'UPLOADED';
}

// A tenant-shared fixed image (watermark, free-shipping badge, ...) reusable
// across templates. `storageKey` = uploadBytes return value (local path / S3
// public URL); resolve for display with resolveThumbUrl. SSOT = backend prompt 15.
export interface TemplateAsset {
  id: number;
  name: string;
  storageKey: string;
  contentType: string | null;
}

export interface ProductThumbnail {
  id: number;
  productId: number;
  sellerId: number;
  sellerName: string;
  templateId: number | null;
  imageUrl: string;
  source: 'GENERATED' | 'MANUAL_OVERRIDE';
  generatedAt: string;
}
