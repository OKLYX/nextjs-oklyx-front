'use client';

import type { ReactNode } from 'react';

/**
 * 모바일(md 미만) 리스트 항목용 공통 카드 셸.
 *
 * 용도: 데스크탑 테이블(`<table>`)의 한 행(row)을 좁은 화면에서 세로 스택 카드로
 * 대체할 때 사용. 각 테이블 컴포넌트는 md 이상에선 `hidden md:block`으로 테이블을,
 * md 미만에선 `md:hidden`으로 이 카드 목록을 렌더한다(반응형 기준: md=768px).
 * 파일: src/presentation/components/DataCard.tsx
 *
 * 필수 규칙: 리스트 화면의 모바일 카드뷰는 직접 div를 만들지 말고 이 컴포넌트를 사용.
 * (라벨/값 배치, 클릭·키보드 접근성, 색 토큰을 한 곳에서 일관되게 관리)
 *
 * Props:
 * - fields: 카드에 표시할 {label, value} 목록. value는 ReactNode(상태 chip 등 허용).
 * - onClick: 있으면 카드 전체가 클릭 가능(행 클릭 → 상세 이동 등). role/tabIndex/Enter·Space 자동 부여.
 * - className: 추가 클래스(선택).
 *
 * @example
 * // 테이블 행을 카드로: 행 클릭 시 상세로 이동
 * <div className="md:hidden space-y-3">
 *   {products.map((p) => (
 *     <DataCard
 *       key={p.id}
 *       onClick={() => router.push(ROUTES.PRODUCT_DETAIL(p.id))}
 *       fields={[
 *         { label: '상품명', value: p.productName },
 *         { label: '가격', value: formatPrice(p.price) },
 *         { label: '상태', value: <StatusChip active={p.active} /> },
 *       ]}
 *     />
 *   ))}
 * </div>
 *
 * ⚠️ 색상은 `bg-white`/`text-gray-*`/`border-gray-*` 토큰만 사용(다크모드 전역 매핑 적용됨).
 * ❌ 금지: 카드마다 다른 구조를 직접 작성 / hex 색 하드코딩 / dark: 변형 개별 추가.
 */
export interface DataCardField {
  label: string;
  value: ReactNode;
}

interface DataCardProps {
  fields: DataCardField[];
  onClick?: () => void;
  className?: string;
}

export function DataCard({ fields, onClick, className }: DataCardProps) {
  const clickable = typeof onClick === 'function';

  return (
    <div
      onClick={onClick}
      role={clickable ? 'button' : undefined}
      tabIndex={clickable ? 0 : undefined}
      onKeyDown={
        clickable
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onClick();
              }
            }
          : undefined
      }
      className={`rounded-lg border border-gray-300 bg-white p-4 ${
        clickable ? 'cursor-pointer hover:bg-gray-50 transition-colors' : ''
      } ${className ?? ''}`}
    >
      <dl className="space-y-1.5">
        {fields.map((field, index) => (
          <div key={index} className="flex items-start justify-between gap-3">
            <dt className="shrink-0 text-xs font-medium text-gray-500">{field.label}</dt>
            <dd className="text-right text-sm text-gray-900">{field.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
