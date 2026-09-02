'use client';

/**
 * 목록 화면 공통 페이지네이션 컴포넌트
 *
 * 서버 페이징 목록의 페이지 이동 UI는 이 컴포넌트를 반드시 사용.
 * 화면마다 화살표/번호 버튼을 새로 만들면 안됨 (규칙 위반).
 *
 * **파일**: src/presentation/components/Pagination.tsx
 *
 * @component
 * @param {number} currentPage - 현재 페이지 인덱스 (0-based)
 * @param {number} totalPages - 전체 페이지 수
 * @param {(page: number) => void} onPageChange - 페이지 버튼 클릭 핸들러 (0-based 인덱스 전달)
 *
 * @example
 * // 총 페이지가 2 이상일 때만 렌더 (호출부 관행)
 * {totalPages > 1 && (
 *   <Pagination currentPage={page} totalPages={totalPages} onPageChange={(p) => updateQuery({ page: p })} />
 * )}
 *
 * @example
 * // 로컬 state 기반 목록
 * <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} />
 *
 * ⚠️ 주의:
 * - 페이지 인덱스는 0-based (표시만 +1). 서버 Page 응답의 `number` 와 같은 축.
 * - `totalPages <= 1` 일 때 숨기는 판단은 호출부 담당 (이 컴포넌트는 항상 렌더).
 *
 * ❌ 금지 패턴:
 * - 페이지별로 페이지네이션 UI 재구현 → 이 컴포넌트 사용
 * - 1-based 인덱스로 호출 → 서버 응답과 어긋남
 */
interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

export function Pagination({ currentPage, totalPages, onPageChange }: PaginationProps) {
  const getPageNumbers = () => {
    const pages = [];
    const range = 2;
    const start = Math.max(0, currentPage - range);
    const end = Math.min(totalPages - 1, currentPage + range);

    for (let i = start; i <= end; i++) {
      pages.push(i);
    }
    return pages;
  };

  const pageNumbers = getPageNumbers();

  return (
    <div className="flex justify-center gap-1 items-center">
      <button
        onClick={() => onPageChange(0)}
        disabled={currentPage === 0}
        className="px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        title="처음으로"
      >
        ⏮
      </button>

      <button
        onClick={() => onPageChange(currentPage - 1)}
        disabled={currentPage === 0}
        className="px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        title="이전"
      >
        ◀
      </button>

      {pageNumbers.map((page) => (
        <button
          key={page}
          onClick={() => onPageChange(page)}
          className={`px-3 py-2 rounded-lg transition-colors ${
            currentPage === page
              ? 'bg-blue-600 text-white border border-blue-600'
              : 'border border-gray-300 hover:bg-gray-50'
          }`}
        >
          {page + 1}
        </button>
      ))}

      <button
        onClick={() => onPageChange(currentPage + 1)}
        disabled={currentPage === totalPages - 1}
        className="px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        title="다음"
      >
        ▶
      </button>

      <button
        onClick={() => onPageChange(totalPages - 1)}
        disabled={currentPage === totalPages - 1}
        className="px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        title="마지막으로"
      >
        ⏭
      </button>
    </div>
  );
}
