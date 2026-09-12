import type { Package } from '@/domain/entities/PackageEntity';

/** `22 × 19 × 9 cm`. 셋 다 0 이면 '미지정'(사이즈가 없던 시절에 만든 상자 — PLAN 2609_38 D4·D8). */
export function formatPackageSize(pkg: Pick<Package, 'widthCm' | 'lengthCm' | 'heightCm'>): string {
  const { widthCm, lengthCm, heightCm } = pkg;
  if (!widthCm && !lengthCm && !heightCm) return '미지정';
  const n = (v: number) => (Number.isInteger(v) ? String(v) : v.toFixed(1));
  return `${n(widthCm)} × ${n(lengthCm)} × ${n(heightCm)} cm`;
}

/** 0 = 미지정 → 입력칸은 빈 값으로 연다(0 이 들어 있으면 최소값 검증에 걸려 저장 버튼이 죽는다). */
export const sizeIsUnset = (pkg: Pick<Package, 'widthCm' | 'lengthCm' | 'heightCm'>): boolean =>
  !pkg.widthCm && !pkg.lengthCm && !pkg.heightCm;
