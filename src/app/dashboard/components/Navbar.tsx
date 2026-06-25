'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import {
  Package,
  Boxes,
  Wallet,
  Tags,
  Store,
  ClipboardList,
  ShoppingCart,
  UserCog,
  type LucideIcon,
} from 'lucide-react';
import { useNavigationStore } from '@/infrastructure/stores/navigationStore';
import { useAuthStore } from '@/infrastructure/stores/authStore';
import { ROUTES } from '@/config/routes';
import { NavbarHeader } from './NavbarHeader';

interface MenuGroup {
  icon: LucideIcon;
  label: string;
  open: boolean;
  toggle: () => void;
  items: { href: string; label: string }[];
}

interface NavbarProps {
  /**
   * Narrow-screen icon rail mode. When true, the sidebar collapses to icons
   * only and reveals labels/submenus on hover (group-hover) — unless pinned.
   * The hovering/width is driven by the wrapping `group` element in layout.tsx.
   */
  collapsible?: boolean;
  /** Pinned open (hamburger click) — keeps labels visible even without hover. */
  pinned?: boolean;
}

export function Navbar({ collapsible = false, pinned = false }: NavbarProps) {
  const isProductsOpen = useNavigationStore((state) => state.isProductsMenuOpen);
  const isStockOpen = useNavigationStore((state) => state.isStockMenuOpen);
  const isCostsOpen = useNavigationStore((state) => state.isCostsMenuOpen);
  const isUsersOpen = useNavigationStore((state) => state.isUsersMenuOpen);
  const isSalesProductsOpen = useNavigationStore((state) => state.isSalesProductsMenuOpen);
  const isSellersOpen = useNavigationStore((state) => state.isSellersMenuOpen);
  const isOrdersOpen = useNavigationStore((state) => state.isOrdersMenuOpen);
  const isPurchaseOpen = useNavigationStore((state) => state.isPurchaseMenuOpen);
  const hasHydrated = useNavigationStore((state) => state.hasHydrated);
  const toggleProductsMenu = useNavigationStore((state) => state.toggleProductsMenu);
  const toggleStockMenu = useNavigationStore((state) => state.toggleStockMenu);
  const toggleCostsMenu = useNavigationStore((state) => state.toggleCostsMenu);
  const toggleUsersMenu = useNavigationStore((state) => state.toggleUsersMenu);
  const toggleSalesProductsMenu = useNavigationStore((state) => state.toggleSalesProductsMenu);
  const toggleSellersMenu = useNavigationStore((state) => state.toggleSellersMenu);
  const toggleOrdersMenu = useNavigationStore((state) => state.toggleOrdersMenu);
  const togglePurchaseMenu = useNavigationStore((state) => state.togglePurchaseMenu);
  const user = useAuthStore((state) => state.user);

  useEffect(() => {
    if (!useNavigationStore.persist.hasHydrated()) {
      useNavigationStore.persist.rehydrate();
    }
  }, []);

  const menuGroups: MenuGroup[] = [
    {
      icon: Package,
      label: '상품관리',
      open: isProductsOpen,
      toggle: toggleProductsMenu,
      items: [
        { href: ROUTES.PRODUCTS_REGISTER, label: '상품등록' },
        { href: ROUTES.PRODUCTS_RETRIEVE, label: '상품조회' },
      ],
    },
    {
      icon: Boxes,
      label: '재고관리',
      open: isStockOpen,
      toggle: toggleStockMenu,
      items: [
        { href: ROUTES.STOCK_IN_OUT, label: '입출고' },
        { href: ROUTES.STOCK_SEARCH, label: '입출고조회' },
      ],
    },
    {
      icon: Wallet,
      label: '비용관리',
      open: isCostsOpen,
      toggle: toggleCostsMenu,
      items: [
        { href: ROUTES.COSTS_CARRIER, label: '택배비' },
        { href: ROUTES.COSTS_PACKAGE, label: '상자비' },
        { href: ROUTES.COSTS_CATEGORY, label: '카테고리' },
        { href: ROUTES.COSTS_COMMISSION_RATE, label: '수수료' },
      ],
    },
    {
      icon: Tags,
      label: '판매상품',
      open: isSalesProductsOpen,
      toggle: toggleSalesProductsMenu,
      items: [
        { href: ROUTES.SALES_PRODUCTS_REGISTER, label: '판매상품 등록' },
        { href: ROUTES.SALES_PRODUCTS_RETRIEVE, label: '판매상품 조회' },
      ],
    },
    {
      icon: Store,
      label: '판매자',
      open: isSellersOpen,
      toggle: toggleSellersMenu,
      items: [{ href: ROUTES.SELLERS_LIST, label: '판매자 관리' }],
    },
    {
      icon: ClipboardList,
      label: '주문관리',
      open: isOrdersOpen,
      toggle: toggleOrdersMenu,
      items: [{ href: ROUTES.ORDERS_RETRIEVE, label: '주문내역' }],
    },
    {
      icon: ShoppingCart,
      label: '구매관리',
      open: isPurchaseOpen,
      toggle: togglePurchaseMenu,
      items: [{ href: ROUTES.PURCHASE_LIST, label: '구매목록' }],
    },
  ];

  if (user?.role === 'ADMIN') {
    menuGroups.push({
      icon: UserCog,
      label: '회원관리',
      open: isUsersOpen,
      toggle: toggleUsersMenu,
      items: [
        { href: ROUTES.USER_REGISTER, label: '회원등록' },
        { href: ROUTES.USER_MANAGE, label: '회원관리' },
      ],
    });
  }

  // Collapsed = icon-only rail. Labels/submenus appear on hover (group-hover)
  // or stay visible when pinned. No-op when not in rail mode.
  const collapsed = collapsible && !pinned;
  const labelCls = collapsed ? 'hidden group-hover:block' : '';
  const subCls = collapsed ? 'hidden group-hover:block' : '';

  return (
    <nav
      className={`${collapsible ? 'w-full' : 'w-56 border-r border-gray-200 bg-white'} min-h-full`}
    >
      {/* Brand header (logo + hamburger pin toggle) — shared with the narrow rail */}
      <NavbarHeader collapsible={collapsible} pinned={pinned} />
      <ul className="space-y-1 py-4">
        {menuGroups.map((menu) => {
          const Icon = menu.icon;
          return (
            <li key={menu.label}>
              <button
                onClick={menu.toggle}
                className="w-full text-left py-2 hover:bg-gray-100 transition-colors flex items-center font-semibold text-gray-900"
              >
                {/* Fixed-width centered icon column (w-16) shared across every
                    state — collapsed rail (w-16), expanded rail (w-56) and the
                    wide static sidebar (w-56) — so the icon's x-position never
                    shifts. The collapsed rail is the reference geometry. */}
                <span className="flex shrink-0 items-center justify-center w-16">
                  <Icon className="w-6 h-6 shrink-0" />
                </span>
                <span className={`flex-1 whitespace-nowrap ${labelCls}`}>{menu.label}</span>
                <span className={`pr-4 ${labelCls}`}>
                  {hasHydrated && menu.open ? '▲' : '▼'}
                </span>
              </button>
              {hasHydrated && menu.open && (
                <ul className={`ml-4 space-y-1 mt-2 ${subCls}`}>
                  {menu.items.map((item) => (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        className="block px-4 py-2 rounded-lg hover:bg-gray-100 transition-colors text-gray-700 whitespace-nowrap"
                      >
                        {item.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
