export const ROUTES = {
  ROOT: '/',
  LOGIN: '/login',
  DASHBOARD: '/dashboard',
  REGISTER: '/register',
  PRODUCTS_RETRIEVE: '/dashboard/products/retrieve',
  PRODUCTS_REGISTER: '/dashboard/products/register',
  PRODUCT_DETAIL: (id: number | string) => `/dashboard/products/retrieve/${id}`,
} as const;
