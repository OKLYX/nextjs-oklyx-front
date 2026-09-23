/**
 * 사이드바 배지 (FEATURE_2609_49).
 *
 * **용도**: 메뉴 항목·그룹에 "처리할 일 N건"을 빨간 동그라미로 붙인다.
 * **파일**: src/app/dashboard/components/NavBadge.tsx
 *
 * ⚠️ 0·null 이면 아무것도 그리지 않는다(빈 동그라미가 남으면 항상 뭔가 있는 것처럼 보인다).
 * ❌ 건수를 화면에서 세지 말 것 — `useAlertSummary` 가 단일 창구다.
 *    ⚠️ 알림 배지에만 걸린 규칙이다. 클립보드(`ClipboardTool`)는 자기 store 길이(`items.length`)를 쓴다.
 */
export function NavBadge({ count }: { count: number | null | undefined }) {
  if (!count) return null;
  return (
    <span className="ml-2 inline-flex min-w-5 items-center justify-center rounded-full bg-red-500 px-1.5 text-xs font-semibold leading-5 text-white">
      {count > 99 ? '99+' : count}
    </span>
  );
}
