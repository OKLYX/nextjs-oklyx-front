/**
 * 사진을 끌 때 커서를 따라다니는 **작은 사진 조각**(사용자 요청 2026-09-25).
 *
 * **용도**: 브라우저 기본 미리보기는 **끌던 요소를 그대로 찍는다** — 상품 사진 카드나 확대 창의
 *   큰 사진 한 장이 커서를 따라다니며 화면을 덮어, 오른쪽 툴바의 **클립보드가 가려 어디에 놓을지
 *   보이지 않는다.** 이 함수는 그 미리보기를 아이콘 크기(56px) 조각으로 바꿔 놓을 자리가 계속 보이게 한다.
 * **파일**: src/infrastructure/utils/dragGhost.ts
 * **쓰는 곳**: 사진을 끄는 `dragstart` 핸들러 — 물품 이미지 갤러리 카드 · 마켓 사진(격자·확대 창) ·
 *   클립보드 패널의 담긴 항목.
 *
 * **사용 예제**
 * ```ts
 * const handleDragStart = (e: React.DragEvent) => {
 *   e.dataTransfer.setData(CLIP_MIME, JSON.stringify(clip));
 *   e.dataTransfer.effectAllowed = 'copy';
 *   setSmallDragImage(e); // 🔴 payload 를 실은 뒤에 부른다
 * };
 * ```
 *
 * ⚠️ **`dragstart` 안에서만** 부를 수 있다 — 브라우저가 그 순간 미리보기 스냅샷을 뜨므로 나중에
 *    부르면 조용히 무시된다.
 * ⚠️ 조각에 그릴 사진은 **끌던 요소 안에 이미 보이고 있는 `<img>`** 를 그대로 복제해서 쓴다(주소를
 *    따로 넘기지 않는다) — 화면에 떠 있던 사진이라 브라우저 캐시에 있어 조각이 비지 않는다.
 * ⚠️ `<img>` 가 없거나 아직 다 받지 못한 항목이면 **아무것도 하지 않는다**(기본 미리보기 유지) —
 *    빈 상자가 따라다니는 것보다 낫다.
 * ⚠️ 조각은 화면 밖에 잠깐 붙였다 다음 틱에 치운다. **문서에 붙지 않은 요소는 브라우저가 미리보기로
 *    쓰지 않는다** — `document.body` 에 붙이는 줄을 지우지 말 것.
 * ❌ 화면마다 자체 조각을 만들지 말 것 — 사진마다 따라다니는 크기가 달라진다.
 * ❌ 캔버스로 그려 넘기지 말 것 — 마켓·S3 사진은 다른 출처라 캔버스가 오염되고, 그 캔버스를 미리보기로
 *    쓰면 브라우저가 빈 그림을 줄 수 있다.
 */

/** 조각 한 변(px). 툴바 아이콘(24px)과 사이드바 메뉴 사이 크기 — 무슨 사진인지는 알아볼 수 있다. */
const GHOST_PX = 56;

/** 커서에서 조각까지의 간격(px). 조각을 커서 오른쪽 아래로 밀어 놓을 지점을 가리지 않게 한다. */
const CURSOR_OFFSET_PX = 8;

export function setSmallDragImage(e: React.DragEvent): void {
  const dt = e.dataTransfer;
  if (!dt || typeof dt.setDragImage !== 'function') return;

  const host = e.currentTarget;
  // 확대 창처럼 `<img>` 자체가 끌리는 곳도 있고, 카드·버튼처럼 안에 품고 있는 곳도 있다.
  const source = host instanceof HTMLImageElement ? host : host.querySelector('img');
  if (!source || !source.complete || source.naturalWidth === 0) return;

  const clone = source.cloneNode(false) as HTMLImageElement;
  clone.removeAttribute('class');
  clone.draggable = false;
  clone.style.width = '100%';
  clone.style.height = '100%';
  clone.style.objectFit = 'contain';

  const ghost = document.createElement('div');
  ghost.setAttribute('aria-hidden', 'true');
  // 흰 바탕 + 테두리 + 그림자: 어떤 화면 위에서도 커서 옆의 작은 조각으로 읽힌다.
  ghost.style.position = 'fixed';
  ghost.style.top = '0';
  ghost.style.left = '-1000px';
  ghost.style.width = `${GHOST_PX}px`;
  ghost.style.height = `${GHOST_PX}px`;
  ghost.style.padding = '2px';
  ghost.style.boxSizing = 'border-box';
  ghost.style.borderRadius = '6px';
  ghost.style.border = '1px solid rgba(0, 0, 0, 0.15)';
  ghost.style.background = '#ffffff';
  ghost.style.boxShadow = '0 2px 6px rgba(0, 0, 0, 0.2)';
  ghost.style.pointerEvents = 'none';
  ghost.appendChild(clone);

  document.body.appendChild(ghost);
  dt.setDragImage(ghost, CURSOR_OFFSET_PX, CURSOR_OFFSET_PX);
  window.setTimeout(() => ghost.remove(), 0);
}
