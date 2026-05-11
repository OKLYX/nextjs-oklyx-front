'use client';

import type { User } from '@/domain/entities/User';

interface UserTableProps {
  users: User[];
  totalElements: number;
  totalPages: number;
  currentPage: number;
  isLoading: boolean;
  error: string | null;
  onPageChange: (page: number) => void;
  onRowClick?: (user: User) => void;
}

function getRoleBadgeStyle(role: string): string {
  switch (role) {
    case 'GUEST':
      return 'bg-gray-100 text-gray-700';
    case 'USER':
      return 'bg-blue-100 text-blue-700';
    case 'ADMIN':
      return 'bg-red-100 text-red-700';
    default:
      return 'bg-gray-100 text-gray-700';
  }
}

function formatDate(dateString: string): string {
  return dateString.substring(0, 10);
}

export function UserTable({
  users,
  totalElements,
  totalPages,
  currentPage,
  isLoading,
  error,
  onPageChange,
  onRowClick,
}: UserTableProps) {
  const getPaginationPages = () => {
    const pages = [];
    const maxPagesToShow = 5;
    let startPage = Math.max(0, currentPage - Math.floor(maxPagesToShow / 2));
    let endPage = Math.min(totalPages - 1, startPage + maxPagesToShow - 1);

    if (endPage - startPage < maxPagesToShow - 1) {
      startPage = Math.max(0, endPage - maxPagesToShow + 1);
    }

    for (let i = startPage; i <= endPage; i++) {
      pages.push(i);
    }
    return pages;
  };

  const paginationPages = getPaginationPages();

  return (
    <div className="bg-white rounded-lg shadow overflow-hidden">
      {error && (
        <div className="bg-red-50 border-l-4 border-red-200 p-4 text-red-700">
          {error}
        </div>
      )}

      {isLoading && !error ? (
        <div className="p-8 text-center text-gray-500">조회 중...</div>
      ) : users.length === 0 ? (
        <div className="p-8 text-center text-gray-500">조회 결과가 없습니다.</div>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-100 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">No.</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">이름</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">이메일</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">역할</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">가입일</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {users.map((user, index) => (
                  <tr
                    key={user.id}
                    onClick={() => onRowClick?.(user)}
                    className={`hover:bg-gray-50 transition-colors ${onRowClick ? 'cursor-pointer' : ''}`}
                  >
                    <td className="px-6 py-3 text-sm text-gray-700">{currentPage * 20 + index + 1}</td>
                    <td className="px-6 py-3 text-sm text-gray-700">{user.name}</td>
                    <td className="px-6 py-3 text-sm text-gray-700">{user.email}</td>
                    <td className="px-6 py-3 text-sm">
                      <span className={`px-3 py-1 rounded-full text-sm font-medium ${getRoleBadgeStyle(user.role)}`}>
                        {user.role}
                      </span>
                    </td>
                    <td className="px-6 py-3 text-sm text-gray-700">{formatDate(user.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="border-t border-gray-200 px-6 py-4 flex items-center justify-center gap-2">
              <button
                onClick={() => onPageChange(Math.max(0, currentPage - 1))}
                disabled={currentPage === 0 || isLoading}
                className="px-3 py-1 border border-gray-300 rounded hover:bg-gray-50 disabled:text-gray-400 disabled:cursor-not-allowed transition-colors text-sm"
              >
                ← 이전
              </button>

              {currentPage > 0 && (
                <button
                  onClick={() => onPageChange(0)}
                  className="px-2 py-1 text-sm text-gray-600 hover:bg-gray-100 rounded"
                >
                  1
                </button>
              )}

              {paginationPages[0] > 1 && (
                <span className="px-2 py-1 text-gray-400">...</span>
              )}

              {paginationPages.map((page) => (
                <button
                  key={page}
                  onClick={() => onPageChange(page)}
                  disabled={isLoading}
                  className={`px-2 py-1 text-sm rounded transition-colors ${
                    currentPage === page
                      ? 'bg-blue-600 text-white'
                      : 'text-gray-600 hover:bg-gray-100 disabled:cursor-not-allowed'
                  }`}
                >
                  {page + 1}
                </button>
              ))}

              {paginationPages[paginationPages.length - 1] < totalPages - 2 && (
                <span className="px-2 py-1 text-gray-400">...</span>
              )}

              {currentPage < totalPages - 1 && (
                <button
                  onClick={() => onPageChange(totalPages - 1)}
                  className="px-2 py-1 text-sm text-gray-600 hover:bg-gray-100 rounded"
                >
                  {totalPages}
                </button>
              )}

              <button
                onClick={() => onPageChange(Math.min(totalPages - 1, currentPage + 1))}
                disabled={currentPage === totalPages - 1 || isLoading}
                className="px-3 py-1 border border-gray-300 rounded hover:bg-gray-50 disabled:text-gray-400 disabled:cursor-not-allowed transition-colors text-sm"
              >
                다음 →
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
