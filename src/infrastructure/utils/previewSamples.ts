/**
 * Sample artwork (backgrounds + objects) for the image-processing preset preview.
 * FEATURE_2609_35 (backgrounds) / FEATURE_2609_52 (objects).
 *
 * **용도**: 색보정 슬라이더의 효과를 확인할 바탕 그림을 캔버스에 직접 그린다.
 * **사용처**: `ProcessingPresetEditor` 미리보기 카드 한 곳.
 *
 * 🔴 **Never draw an external image here.** Putting an `<img>` / SVG data URI / S3 asset on the
 *    canvas taints it, which blocks `getImageData` and kills the live color-adjust preview
 *    outright. Everything is drawn with shapes and gradients only.
 * ⚠️ Paint order is owned by the caller: background → object → color adjust. The object is a
 *    color-adjust target too — that is the whole point of having it (2609_52 PLAN D6).
 */

export const PREVIEW_SIZE = 400;

// ---------------------------------------------------------------------------
// Backgrounds (moved verbatim from ProcessingPresetEditor, 2609_35)
// ---------------------------------------------------------------------------

// 채도·색온도가 읽힐 1차/2차색 바(방송 컬러바 순서: 휘도 내림차순).
const CHART_BARS = ['#ffffff', '#ffff00', '#00ffff', '#00ff00', '#ff00ff', '#ff0000', '#0000ff'];
// 색온도·채도가 가장 눈에 잘 띄는 기억색(피부·하늘·잎·중성회색 18%).
const CHART_PATCHES = ['#e0ac69', '#4a90d9', '#4a7c3f', '#7f7f7f'];
const CHART_STEPS = 11; // 계단 그레이스케일 칸 수(밝기·대비의 클리핑이 칸 병합으로 보인다)

function paintGradient(ctx: CanvasRenderingContext2D, stops: [number, string][]) {
  const grad = ctx.createLinearGradient(0, 0, PREVIEW_SIZE, PREVIEW_SIZE);
  for (const [offset, color] of stops) grad.addColorStop(offset, color);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, PREVIEW_SIZE, PREVIEW_SIZE);
}

// 반올림 틈이 남지 않도록 마지막 칸은 캔버스 끝까지 채운다.
function bandX(index: number, count: number): { x: number; w: number } {
  const unit = PREVIEW_SIZE / count;
  const x = Math.round(index * unit);
  const end = index === count - 1 ? PREVIEW_SIZE : Math.round((index + 1) * unit);
  return { x, w: end - x };
}

// 화면 조정 차트. 위에서부터 컬러바 / 계단 그레이스케일 / 연속 램프 / 기억색 패치.
// 슬라이더별로 반응하는 대역이 다르다: 밝기·대비=계단/램프, 채도=컬러바, 색온도=패치.
function paintTestChart(ctx: CanvasRenderingContext2D) {
  const barsH = Math.round(PREVIEW_SIZE * 0.38);
  const stepsH = Math.round(PREVIEW_SIZE * 0.16);
  const rampH = Math.round(PREVIEW_SIZE * 0.1);
  const patchY = barsH + stepsH + rampH;

  // 1) 컬러바 — 채도를 내리면 위에서부터 회색으로 무너진다.
  CHART_BARS.forEach((color, i) => {
    const { x, w } = bandX(i, CHART_BARS.length);
    ctx.fillStyle = color;
    ctx.fillRect(x, 0, w, barsH);
  });

  // 2) 계단 그레이스케일 — 밝기/대비가 양 끝 칸을 언제 맞붙이는지(클리핑) 보여준다.
  for (let i = 0; i < CHART_STEPS; i += 1) {
    const v = Math.round((i / (CHART_STEPS - 1)) * 255);
    const { x, w } = bandX(i, CHART_STEPS);
    ctx.fillStyle = `rgb(${v}, ${v}, ${v})`;
    ctx.fillRect(x, barsH, w, stepsH);
  }

  // 3) 연속 램프 — 계단이 가리는 중간 톤의 이동을 매끄럽게 보여준다.
  const ramp = ctx.createLinearGradient(0, 0, PREVIEW_SIZE, 0);
  ramp.addColorStop(0, '#000000');
  ramp.addColorStop(1, '#ffffff');
  ctx.fillStyle = ramp;
  ctx.fillRect(0, barsH + stepsH, PREVIEW_SIZE, rampH);

  // 4) 기억색 패치 — 색온도를 올리면 피부가 붉고 하늘이 탁해지는 게 바로 보인다.
  CHART_PATCHES.forEach((color, i) => {
    const { x, w } = bandX(i, CHART_PATCHES.length);
    ctx.fillStyle = color;
    ctx.fillRect(x, patchY, w, PREVIEW_SIZE - patchY);
  });
}

export const SAMPLE_BACKGROUNDS: {
  label: string;
  paint: (ctx: CanvasRenderingContext2D) => void;
  /** Measurement chart — an object on top would hide the steps/patches (2609_52 D4). */
  noObject?: boolean;
}[] = [
  { label: '밝은 배경', paint: (ctx) => paintGradient(ctx, [[0, '#f8fafc'], [1, '#cbd5e1']]) },
  { label: '어두운 배경', paint: (ctx) => paintGradient(ctx, [[0, '#334155'], [1, '#0f172a']]) },
  { label: '컬러 배경', paint: (ctx) => paintGradient(ctx, [[0, '#ef4444'], [0.5, '#f59e0b'], [1, '#3b82f6']]) },
  { label: '화면 조정', paint: paintTestChart, noObject: true },
];

// ---------------------------------------------------------------------------
// Objects (2609_52) — one sphere, so bright face / mid tone / dark face / highlight
// all sit in the same frame and you can see which tone collapses first.
// ---------------------------------------------------------------------------

const OBJ_CX = PREVIEW_SIZE / 2;
const OBJ_CY = PREVIEW_SIZE / 2;
const OBJ_R = PREVIEW_SIZE * 0.27;
// One light, upper-left, shared by every object — otherwise they cannot be compared.
const LIGHT_X = OBJ_CX - OBJ_R * 0.4;
const LIGHT_Y = OBJ_CY - OBJ_R * 0.45;

function circlePath(ctx: CanvasRenderingContext2D) {
  ctx.beginPath();
  ctx.arc(OBJ_CX, OBJ_CY, OBJ_R, 0, Math.PI * 2);
}

/** Contact shadow — drawn first, so the object sits on the ground instead of floating. */
function paintContactShadow(ctx: CanvasRenderingContext2D) {
  const y = OBJ_CY + OBJ_R * 0.96;
  ctx.save();
  ctx.translate(OBJ_CX, y);
  ctx.scale(1, 0.2); // circle → flattened ellipse
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, OBJ_R * 1.05);
  g.addColorStop(0, 'rgba(0,0,0,0.5)');
  g.addColorStop(0.6, 'rgba(0,0,0,0.22)');
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(0, 0, OBJ_R * 1.05, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/**
 * Specular highlight — the last thing painted on a body.
 * 🔴 Pure white on purpose: it is the first thing to blow out when brightness goes up, and that
 *    is exactly the information this preview exists to show. Do not tone it down to "look nicer".
 */
function paintSpecular(ctx: CanvasRenderingContext2D, strength: number, spread: number) {
  ctx.save();
  circlePath(ctx);
  ctx.clip();
  const g = ctx.createRadialGradient(LIGHT_X, LIGHT_Y, 0, LIGHT_X, LIGHT_Y, OBJ_R * spread);
  g.addColorStop(0, `rgba(255,255,255,${strength})`);
  g.addColorStop(0.5, `rgba(255,255,255,${strength * 0.25})`);
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, PREVIEW_SIZE, PREVIEW_SIZE);
  ctx.restore();
}

/** Bounce light on the far side — keeps the shadow face from dying into flat black. */
function paintRimLight(ctx: CanvasRenderingContext2D, alpha: number) {
  const rx = OBJ_CX + OBJ_R * 0.55;
  const ry = OBJ_CY + OBJ_R * 0.6;
  ctx.save();
  circlePath(ctx);
  ctx.clip();
  const g = ctx.createRadialGradient(rx, ry, OBJ_R * 0.1, rx, ry, OBJ_R * 0.85);
  g.addColorStop(0, `rgba(255,255,255,${alpha})`);
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, PREVIEW_SIZE, PREVIEW_SIZE);
  ctx.restore();
}

/** Body of a solid sphere: gradient focus pushed toward the light makes the curvature read. */
function paintSolidSphere(ctx: CanvasRenderingContext2D, stops: [number, string][]) {
  const g = ctx.createRadialGradient(
    LIGHT_X, LIGHT_Y, OBJ_R * 0.05,
    OBJ_CX, OBJ_CY, OBJ_R,
  );
  for (const [offset, color] of stops) g.addColorStop(offset, color);
  ctx.fillStyle = g;
  circlePath(ctx);
  ctx.fill();
}

// 🔴 The top stop is NOT pure white: a white highlight over a white body reads flat, and the
//    object then tells you nothing about where the tones collapse.
const WHITE_BODY: [number, string][] = [[0, '#f4f4f5'], [0.5, '#dcdee1'], [1, '#9aa1a9']];
const BLACK_BODY: [number, string][] = [[0, '#787d84'], [0.45, '#2c2f33'], [1, '#07080a']];

/** White object — pair with the light background, raise brightness, watch the outline vanish. */
function paintWhiteSphere(ctx: CanvasRenderingContext2D) {
  paintContactShadow(ctx);
  paintSolidSphere(ctx, WHITE_BODY);
  paintRimLight(ctx, 0.18);
  paintSpecular(ctx, 0.9, 0.42);
}

/** Black object — pair with the dark background, raise contrast, watch it merge into it. */
function paintBlackSphere(ctx: CanvasRenderingContext2D) {
  paintContactShadow(ctx);
  paintSolidSphere(ctx, BLACK_BODY);
  paintRimLight(ctx, 0.22); // a dark surface shows bounce light more
  paintSpecular(ctx, 1, 0.3); // and takes a smaller, harder highlight
}

const OBJ_HUES = ['#ef4444', '#f59e0b', '#eab308', '#22c55e', '#3b82f6', '#a855f7', '#ef4444'];

/**
 * Colourful object — shows saturation/temperature moving across several hues at once.
 * ⚠️ Overlaps the test chart's colour bars on purpose (2026-09-16: "겹쳐도 된다, 느낌만 본다").
 *    Do not drop this object, or touch the chart, to remove that overlap.
 */
function paintColorfulSphere(ctx: CanvasRenderingContext2D) {
  paintContactShadow(ctx);
  ctx.save();
  circlePath(ctx);
  ctx.clip();
  const cg = ctx.createConicGradient(-Math.PI / 2, OBJ_CX, OBJ_CY);
  OBJ_HUES.forEach((color, i) => cg.addColorStop(i / (OBJ_HUES.length - 1), color));
  ctx.fillStyle = cg;
  ctx.fillRect(0, 0, PREVIEW_SIZE, PREVIEW_SIZE);
  // Multiply the same spherical shading over it: hues survive, only the tone bends.
  ctx.globalCompositeOperation = 'multiply';
  const shade = ctx.createRadialGradient(LIGHT_X, LIGHT_Y, OBJ_R * 0.05, OBJ_CX, OBJ_CY, OBJ_R);
  shade.addColorStop(0, '#ffffff');
  shade.addColorStop(0.55, '#d0d0d0');
  shade.addColorStop(1, '#4a4a4a');
  ctx.fillStyle = shade;
  ctx.fillRect(0, 0, PREVIEW_SIZE, PREVIEW_SIZE);
  ctx.restore(); // ⚠️ restores globalCompositeOperation too — everything after would multiply
  paintRimLight(ctx, 0.14);
  paintSpecular(ctx, 0.85, 0.36);
}

/**
 * Glass object. What makes a transparent thing readable is the background coming *through* it,
 * so the already-painted background is re-drawn inside the circle, magnified and flipped (a solid
 * glass ball inverts the image behind it). Drawing the canvas onto itself is same-origin and does
 * not taint it, so the D1 rule above still holds.
 * ⚠️ Refraction is an approximation — it will not match a real photo of a glass product. What it
 *    is good for is checking that the rim and the highlights survive the correction.
 */
function paintGlassSphere(ctx: CanvasRenderingContext2D) {
  paintContactShadow(ctx);
  ctx.save();
  circlePath(ctx);
  ctx.clip();

  const zoom = 1.4;
  const half = OBJ_R / zoom;
  ctx.translate(OBJ_CX, OBJ_CY);
  ctx.scale(-1, -1);
  ctx.translate(-OBJ_CX, -OBJ_CY);
  ctx.drawImage(
    ctx.canvas,
    OBJ_CX - half, OBJ_CY - half, half * 2, half * 2,
    OBJ_CX - OBJ_R, OBJ_CY - OBJ_R, OBJ_R * 2, OBJ_R * 2,
  );
  ctx.setTransform(1, 0, 0, 1, 0, 0); // 🔴 undo the flip; the clip above stays in effect

  // A faint film, otherwise there is no sign anything is standing there at all.
  ctx.fillStyle = 'rgba(255,255,255,0.10)';
  ctx.fillRect(0, 0, PREVIEW_SIZE, PREVIEW_SIZE);

  // The edge is the thickness — glass reads by its rim.
  const rim = ctx.createRadialGradient(OBJ_CX, OBJ_CY, OBJ_R * 0.7, OBJ_CX, OBJ_CY, OBJ_R);
  rim.addColorStop(0, 'rgba(255,255,255,0)');
  rim.addColorStop(0.82, 'rgba(255,255,255,0.28)');
  rim.addColorStop(1, 'rgba(255,255,255,0.75)');
  ctx.fillStyle = rim;
  ctx.fillRect(0, 0, PREVIEW_SIZE, PREVIEW_SIZE);
  ctx.restore();

  // Two highlights: a broad one plus a small hard dot, which is what reads as glass.
  paintSpecular(ctx, 0.55, 0.3);
  ctx.save();
  circlePath(ctx);
  ctx.clip();
  const dotX = OBJ_CX + OBJ_R * 0.42;
  const dotY = OBJ_CY + OBJ_R * 0.48;
  const dot = ctx.createRadialGradient(dotX, dotY, 0, dotX, dotY, OBJ_R * 0.16);
  dot.addColorStop(0, 'rgba(255,255,255,0.95)');
  dot.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = dot;
  ctx.fillRect(0, 0, PREVIEW_SIZE, PREVIEW_SIZE);
  ctx.restore();
}

/** Sample objects to stand in front of the background. First entry = default (unchanged view). */
export const SAMPLE_OBJECTS: {
  label: string;
  paint: ((ctx: CanvasRenderingContext2D) => void) | null;
}[] = [
  { label: '없음', paint: null },
  { label: '흰 물체', paint: paintWhiteSphere },
  { label: '검은 물체', paint: paintBlackSphere },
  { label: '알록달록 물체', paint: paintColorfulSphere },
  { label: '투명 물체', paint: paintGlassSphere },
];
