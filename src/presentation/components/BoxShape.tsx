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
 * - **모양은 비율만** 반영한다. 가로(width) × 높이(height) 를 앞면으로 그리고, 세로(length)를
 *   깊이로 비스듬히 세운다.
 * - `referenceCm` 을 주면 **그림이 차지하는 크기까지 실제 치수에 비례**한다. 목록에서 큰 상자와
 *   작은 상자를 눈으로 비교하려면 이 값을 반드시 준다(`maxBoxExtentCm(목록)`).
 *   주지 않으면 예전처럼 항상 `size` 정사각을 가득 채운다(단건 화면용).
 * - 치수가 하나라도 비어 있으면(0 = 미지정, 2609_38 백필이 남긴 값) **점선 상자 + 「치수 미지정」**.
 *
 * **Props**
 * | prop | 설명 |
 * |---|---|
 * | `widthCm` · `lengthCm` · `heightCm` | 상자 치수. 0 = 미지정 |
 * | `size?` | 가장 큰 상자가 차지할 정사각 한 변(px). 기본 44 |
 * | `referenceCm?` | 비교 기준이 되는 가장 큰 상자의 `boxExtentCm`. 주면 실제 크기 비례로 그린다 |
 * | `className?` | 배치 보정용 추가 클래스 |
 *
 * **사용 예제**
 * ```tsx
 * // 목록 셀 — 목록 안에서 대소 비교가 보이게
 * const referenceCm = maxBoxExtentCm(packages);
 * <BoxShape widthCm={pkg.widthCm} lengthCm={pkg.lengthCm} heightCm={pkg.heightCm}
 *           size={72} referenceCm={referenceCm} />
 *
 * // 단건 상세 — 비교 대상이 없으므로 기준 없이 가득 채워 그린다
 * <BoxShape widthCm={box.widthCm} lengthCm={box.lengthCm} heightCm={box.heightCm} size={96} />
 * ```
 *
 * ⚠️ `referenceCm` 없이 그린 그림끼리는 크기를 비교하지 말 것 — 정규화되어 있어 1cm 상자와
 * 100cm 상자가 같은 면적을 차지한다.
 * ❌ 화면마다 자체 SVG 를 새로 그리지 않는다.
 */

export interface BoxDimensionsCm {
  widthCm: number;
  lengthCm: number;
  heightCm: number;
}

export interface BoxShapeProps extends BoxDimensionsCm {
  /** 가장 큰 상자가 차지할 정사각 한 변(px). 기본 44 */
  size?: number;
  /** 비교 기준(목록에서 가장 큰 상자의 boxExtentCm). 없으면 정규화해 가득 채운다 */
  referenceCm?: number;
  className?: string;
}

/** 세로(깊이)를 비스듬히 눕히는 비율. 낮으면 납작해 보이고 높으면 앞면이 작아진다 */
const DEPTH_RATIO = 0.4;

/** 아무리 작은 상자도 이 배율 아래로는 줄이지 않는다 — 점으로 보이면 모양 구분이 불가능하다 */
const MIN_SCALE = 0.4;

/** 치수가 하나라도 비었는지 */
function isUnset({ widthCm, lengthCm, heightCm }: BoxDimensionsCm): boolean {
  return !(widthCm > 0) || !(lengthCm > 0) || !(heightCm > 0);
}

/**
 * 그림이 차지하는 한 변(cm 단위). 깊이까지 포함한 외곽 크기라 이 값끼리의 비가
 * 곧 화면에서 보이는 크기 비가 된다. 치수 미지정이면 0.
 */
export function boxExtentCm(box: BoxDimensionsCm): number {
  if (isUnset(box)) return 0;
  const depth = box.lengthCm * DEPTH_RATIO;
  return Math.max(box.widthCm + depth, box.heightCm + depth);
}

/** 목록에서 가장 큰 상자의 extent. 비교 기준(`referenceCm`)으로 넘긴다 */
export function maxBoxExtentCm(boxes: BoxDimensionsCm[]): number {
  return boxes.reduce((max, box) => Math.max(max, boxExtentCm(box)), 0);
}

/**
 * 기준 대비 배율(MIN_SCALE ~ 1). 사진(`<img>`)을 그리는 호출부도 이 배율을 써야
 * 사진 있는 상자와 없는 상자가 같은 잣대로 보인다.
 */
export function boxScale(box: BoxDimensionsCm, referenceCm?: number): number {
  if (!referenceCm || referenceCm <= 0) return 1;
  const extent = boxExtentCm(box);
  if (extent <= 0) return MIN_SCALE;
  return Math.min(1, Math.max(MIN_SCALE, extent / referenceCm));
}

export function BoxShape({
  widthCm,
  lengthCm,
  heightCm,
  size = 44,
  referenceCm,
  className,
}: BoxShapeProps) {
  const dimensions = { widthCm, lengthCm, heightCm };
  const rendered = size * boxScale(dimensions, referenceCm);

  if (isUnset(dimensions)) {
    return (
      <span
        className={`inline-flex flex-col items-center gap-0.5 text-gray-400 ${className ?? ''}`}
        title="치수 미지정"
      >
        <svg
          width={rendered}
          height={rendered}
          viewBox="0 0 10 10"
          role="img"
          aria-label="치수 미지정 상자"
        >
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
      width={rendered}
      height={rendered}
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
