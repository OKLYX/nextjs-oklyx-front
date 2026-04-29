'use client';

import { useState } from 'react';
import Link from 'next/link';

export function Navbar() {
  const [isProductsOpen, setIsProductsOpen] = useState(false);

  return (
    <nav className="w-56 border-r border-gray-200 bg-white min-h-full">
      <ul className="space-y-1 p-4">
        <li>
          <button
            onClick={() => setIsProductsOpen(!isProductsOpen)}
            className="w-full text-left px-4 py-2 rounded-lg hover:bg-gray-100 transition-colors flex items-center justify-between font-medium"
          >
            상품관리
            <span>{isProductsOpen ? '▲' : '▼'}</span>
          </button>
          {isProductsOpen && (
            <ul className="ml-4 space-y-1 mt-2">
              <li>
                <Link
                  href="/dashboard/products/new"
                  className="block px-4 py-2 rounded-lg hover:bg-gray-100 transition-colors text-gray-700"
                >
                  상품등록
                </Link>
              </li>
              <li>
                <Link
                  href="/dashboard/products"
                  className="block px-4 py-2 rounded-lg hover:bg-gray-100 transition-colors text-gray-700"
                >
                  상품조회
                </Link>
              </li>
            </ul>
          )}
        </li>
      </ul>
    </nav>
  );
}
