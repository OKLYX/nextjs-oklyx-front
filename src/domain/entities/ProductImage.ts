// A single image in a product's 1:N source gallery (backend 39).
// `imageUrl` is the stored value as-is: an S3 public URL on dev/prod, a local
// disk-relative path on local/test — render via resolveThumbUrl (http → direct,
// else uploads proxy), same rule as the master pool / thumbnails.
// ⚠️ Do NOT confuse with the single representative Product.imageUrl (its own
// proxy). The gallery is a separate resource under /api/admin/products/{id}/images.
export interface ProductImage {
  id: number;
  productId: number;
  sortOrder: number;
  imageUrl: string;
}
