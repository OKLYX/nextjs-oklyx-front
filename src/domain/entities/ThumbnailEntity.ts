// Thumbnail template domain types. SSOT = backend contract (prompt 01/02).
// If the implemented API diverges, the implemented API wins.

export type ElementType = 'text' | 'image';

// Allowed bind values are the backend contract SSOT. Confirmed:
//   text  -> 'brandName' | 'productName'
//   image -> 'productImage'
// Only these are exposed in the editor Select / sample inputs. Extend only
// when the backend (01) adds more — no arbitrary additions.
export type TextBind = 'brandName' | 'productName';
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

export interface ElementPadding {
  top: number;
  bottom: number;
  left: number;
  right: number;
}

export interface TemplateElement {
  type: ElementType;
  bind: TextBind | ImageBind | null; // text -> TextBind / image -> ImageBind (or fixed src)
  src: string | null; // image: fixed storage key
  region: ElementRegion; // canvas source coordinates (px)
  align: ElementAlign;
  padding: ElementPadding;
  fontId: number | null;
  color: string | null; // '#RRGGBB'
  maxFontSize: number;
  minFontSize: number;
  maxLines: number;
  opacity: number; // image
}

export interface ThumbnailTemplate {
  id: number;
  name: string;
  canvasWidth: number;
  canvasHeight: number;
  backgroundMode: BackgroundMode;
  gradientTopColor: string | null; // '#RRGGBB', used only when GRADIENT_MANUAL
  gradientBottomColor: string | null; // '#RRGGBB', used only when GRADIENT_MANUAL
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
