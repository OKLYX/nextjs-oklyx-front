'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { useNavigationStore } from '@/infrastructure/stores/navigationStore';
import { ROUTES } from '@/config/routes';

export function Navbar() {
  const isProductsOpen = useNavigationStore((state) => state.isProductsMenuOpen);
  const isStockOpen = useNavigationStore((state) => state.isStockMenuOpen);
  const hasHydrated = useNavigationStore((state) => state.hasHydrated);
  const toggleProductsMenu = useNavigationStore((state) => state.toggleProductsMenu);
  const toggleStockMenu = useNavigationStore((state) => state.toggleStockMenu);

  useEffect(() => {
    if (!useNavigationStore.persist.hasHydrated()) {
      useNavigationStore.persist.rehydrate();
    }
  }, []);

  return (
    <nav className="w-56 border-r border-gray-200 bg-white min-h-full">
      <ul className="space-y-1 p-4">
        <li>
          <button
            onClick={toggleProductsMenu}
            className="w-full text-left px-4 py-2 rounded-lg hover:bg-gray-100 transition-colors flex items-center justify-between font-semibold text-gray-900"
          >
            상품관리
            <span>{hasHydrated && isProductsOpen ? '▲' : '▼'}</span>
          </button>
          {hasHydrated && isProductsOpen && (
            <ul className="ml-4 space-y-1 mt-2">
              <li>
                <Link
                  href={ROUTES.PRODUCTS_REGISTER}
                  className="block px-4 py-2 rounded-lg hover:bg-gray-100 transition-colors text-gray-700"
                >
                  상품등록
                </Link>
              </li>
              <li>
                <Link
                  href={ROUTES.PRODUCTS_RETRIEVE}
                  className="block px-4 py-2 rounded-lg hover:bg-gray-100 transition-colors text-gray-700"
                >
                  상품조회
                </Link>
              </li>
            </ul>
          )}
        </li>
        <li>
          <button
            onClick={toggleStockMenu}
            className="w-full text-left px-4 py-2 rounded-lg hover:bg-gray-100 transition-colors flex items-center justify-between font-semibold text-gray-900"
          >
            재고관리
            <span>{hasHydrated && isStockOpen ? '▲' : '▼'}</span>
          </button>
          {hasHydrated && isStockOpen && (
            <ul className="ml-4 space-y-1 mt-2">
              <li>
                <Link
                  href={ROUTES.STOCK_IN_OUT}
                  className="block px-4 py-2 rounded-lg hover:bg-gray-100 transition-colors text-gray-700"
                >
                  입출고
                </Link>
              </li>
              <li>
                <Link
                  href={ROUTES.STOCK_SEARCH}
                  className="block px-4 py-2 rounded-lg hover:bg-gray-100 transition-colors text-gray-700"
                >
                  입출고조회
                </Link>
              </li>
            </ul>
          )}
        </li>
      </ul>
    </nav>
  );
}
