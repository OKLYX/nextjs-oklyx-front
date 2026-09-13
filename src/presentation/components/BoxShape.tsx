'use client';

/**
 * 상자를 **치수 비율대로** 그린 도형 (PLAN 2609_40 D26).
 *
 * **용도**: 사진이 없는 상자를 목록·포장 화면에서 구분하기 위한 그림. 사진의 대체물이지
 * 저장되는 이미지가 아니다.
 * **파일**: src/presentation/components/BoxShape.tsx
 *
 * **필수 사용 규칙**
 * - 상자를 그림으로 보여주는 화면은 **전부 이 컴포넌트를 쓴다**. 상자 관리 목록과 포장 화면(05)의
 *   상자 후보 카드가 서로 다르게 그리면 **같은 상자가 다른 상자처럼 보인다**.
 * - 사진이 있으면 이 컴포넌트를 쓰지 않고 `<img>` 를 그린다. 판단은 호출부가 한다
 *   (`pkg.imageUrl ? <img …/> : <BoxShape …/>`).
 *
 * **그리는 규칙**
 * - **비율만** 반영한다. 실제 크기(cm)가 아니라 가장 긴 변을 기준으로 정규화한 모양이다 —
 *   1cm 상자와 100cm 상자가 비율이 같으면 같은 그림이다.
 * - 가로(width) × 높이(height) 를 앞면으로 그리고, 세로(length)를 깊이로 비스듬히 세운다.
 * - 치수가 하나라도 비어 있으면(0 = 미지정, 2609_38 백필이 남긴 값) **점선 상자 + 「치수 미지정」**.
 *
 * **Props**
 * | prop | 설명 |
 * |---|---|
 * | `widthCm` · `lengthCm` · `heightCm` | 상자 치수. 0 = 미지정 |
 * | `size?` | 그림이 차지할 정사각 한 변(px). 기본 44 |
 * | `className?` | 배치 보정용 추가 클래스 |
 *
 * **사용 예제**
 * ```tsx
 * // 목록 셀 (작게)
 * <BoxShape widthCm={pkg.widthCm} lengthCm={pkg.lengthCm} heightCm={pkg.heightCm} />
 *
 * // 포장 화면 상자 후보 카드 (크게)
 * <BoxShape widthCm={box.widthCm} lengthCm={box.lengthCm} heightCm={box.heightCm} size={96} />
 * ```
 *
 * ⚠️ 실제 크기 비교(어느 상자가 더 큰가)에 쓰지 말 것 — 정규화되어 있어 항상 같은 면적을 차지한다.
 * ❌ 화면마다 자체 SVG 를 새로 그리지 않는다.
 */

export interface BoxShapeProps {
  widthCm: number;
  lengthCm: number;
  heightCm: number;
  /** 정사각 한 변(px). 기본 44 */
  size?: number;
  className?: string;
}

/** 세로(깊이)를 비스듬히 눕히는 비율. 낮으면 납작해 보이고 높으면 앞면이 작아진다 */
const DEPTH_RATIO = 0.4;

export function BoxShape({
  widthCm,
  lengthCm,
  heightCm,
  size = 44,
  className,
}: BoxShapeProps) {
  const unset = !(widthCm > 0) || !(lengthCm > 0) || !(heightCm > 0);

  if (unset) {
    return (
      <span
        className={`inline-flex flex-col items-center gap-0.5 text-gray-400 ${className ?? ''}`}
        title="치수 미지정"
      >
        <svg width={size} height={size} viewBox="0 0 10 10" role="img" aria-label="치수 미지정 상자">
          <rect
            x="1"
            y="1"
            width="8"
            height="8"
            fill="none"
            stroke="currentColor"
            strokeWidth="1"
            strokeDasharray="2 1.5"
            vectorEffect="non-scaling-stroke"
          />
        </svg>
        <span className="text-[10px] leading-none whitespace-nowrap">치수 미지정</span>
      </span>
    );
  }

  // 깊이는 세로를 눕힌 길이다. viewBox 가 곧 정규화라 별도 스케일 계산이 필요 없다.
  const depth = lengthCm * DEPTH_RATIO;
  const w = widthCm;
  const h = heightCm;
  const vbW = w + depth;
  const vbH = h + depth;

  const label = `${widthCm} × ${lengthCm} × ${heightCm} cm 상자`;

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${vbW} ${vbH}`}
      preserveAspectRatio="xMidYMid meet"
      role="img"
      aria-label={label}
      className={className}
    >
      <title>{label}</title>
      {/* 앞면 */}
      <rect
        x="0"
        y={depth}
        width={w}
        height={h}
        className="fill-amber-100 stroke-amber-700"
        strokeWidth="1"
        vectorEffect="non-scaling-stroke"
      />
      {/* 윗면 */}
      <polygon
        points={`0,${depth} ${depth},0 ${w + depth},0 ${w},${depth}`}
        className="fill-amber-50 stroke-amber-700"
        strokeWidth="1"
        vectorEffect="non-scaling-stroke"
      />
      {/* 옆면 */}
      <polygon
        points={`${w},${depth} ${w + depth},0 ${w + depth},${h} ${w},${h + depth}`}
        className="fill-amber-200 stroke-amber-700"
        strokeWidth="1"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}
