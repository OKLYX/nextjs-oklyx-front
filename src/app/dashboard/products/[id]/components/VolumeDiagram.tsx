/**
 * 부피 입력칸 옆 안내 그림 — 너비·깊이·높이가 상자의 어느 변인지 보여준다.
 * 정면(흰 면) 기준: 너비 = 정면 가로, 높이 = 정면 세로, 깊이 = 앞에서 뒤로 들어가는 변.
 * 색은 Tailwind 유틸(fill/stroke/text)로만 준다 — hex 하드코딩 금지(다크모드·브랜드 리맵 규칙).
 *
 * **파일**: src/app/dashboard/products/[id]/components/VolumeDiagram.tsx
 * **쓰는 곳**: `ProductRegistrationForm` · `ProductEditForm` — 두 화면의 「부피」 칸은 같은 모양이어야 한다.
 *
 * **Props**
 * - `embedded`: 판매 상품 관리 패널 안(좁은 폭)이면 `true` → 가로 폭을 꽉 채운다.
 *
 * **사용 예제**
 * ```tsx
 * <VolumeDiagram embedded={false} />   // 페이지(등록·수정)
 * <VolumeDiagram embedded />           // 패널 [새 물품 등록]
 * ```
 *
 * ⚠️ `<marker id="volArrow">` 는 문서 전역 id 다 — 한 화면에 두 번 그리지 말 것.
 */
export function VolumeDiagram({ embedded }: { embedded: boolean }) {
  return (
    <div
      className={`shrink-0 ${embedded ? 'w-full' : 'sm:w-72'} rounded-lg border border-gray-200 bg-gray-50 p-4 flex flex-col items-center justify-center`}
    >
      <svg viewBox="0 0 220 160" className="w-full max-w-[240px]" role="img" aria-label="너비·깊이·높이 안내 그림">
        <defs>
          <marker id="volArrow" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
            <path d="M0 0 L10 5 L0 10 z" className="fill-blue-600" />
          </marker>
        </defs>
        {/* box: top and right faces tinted, front face white */}
        <path d="M60 40 L90 16 L150 16 L120 40 Z" className="fill-amber-100 stroke-gray-500" strokeWidth="1.5" strokeLinejoin="round" />
        <path d="M120 40 L150 16 L150 88 L120 112 Z" className="fill-amber-200 stroke-gray-500" strokeWidth="1.5" strokeLinejoin="round" />
        <rect x="60" y="40" width="60" height="72" className="fill-white stroke-gray-500" strokeWidth="1.5" />
        {/* dimension arrows */}
        <g className="stroke-blue-600" strokeWidth="1.5" markerStart="url(#volArrow)" markerEnd="url(#volArrow)">
          <line x1="42" y1="42" x2="42" y2="110" />
          <line x1="62" y1="128" x2="118" y2="128" />
          <line x1="128" y1="118" x2="154" y2="97" />
        </g>
        <g className="fill-blue-600" fontSize="13" fontWeight="600" textAnchor="middle">
          <text x="24" y="80">높이</text>
          <text x="90" y="148">너비</text>
          <text x="176" y="118">깊이</text>
        </g>
      </svg>
      <p className="mt-2 text-xs text-gray-500">상품 정면 기준으로 측정</p>
    </div>
  );
}
