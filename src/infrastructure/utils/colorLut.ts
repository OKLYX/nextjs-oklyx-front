/**
 * Color-correction math for the image-processing preset preview (FEATURE_2609_35).
 *
 * ⚠️ Mirror of `service/ImageColorAdjustSupport.java` (backend = SSOT of the formula).
 * 상수·연산 순서·계수를 바꾸려면 **백엔드와 같이 바꿀 것** — 이 파일의 존재 이유가
 * "미리보기 = 실제 결과"이기 때문에 둘이 어긋나면 미리보기가 거짓말이 된다.
 *
 * Formula (brightness/contrast/temperature → per-channel 256-entry LUT; saturation
 * cannot be a LUT because luminance depends on all three channels):
 *   bGain  = 1 + brightness / 100
 *   cGain  = 1 + contrast   / 100
 *   tShift = (temperature / 100) * 0.2      // ±20% R/B gain, G untouched
 *   chGain = [bGain * (1 + tShift), bGain, bGain * (1 - tShift)]
 *   lut[ch][v] = clamp255(round(((v / 255) * chGain[ch] - 0.5) * cGain + 0.5) * 255)
 *   lum = 0.2126 R + 0.7152 G + 0.0722 B    // Rec.709
 *   out = clamp255(lum + (channel - lum) * (1 + saturation / 100))
 *
 * ⚠️ `Uint8ClampedArray` 는 소수를 대입하면 half-to-even 으로 반올림한다(2.5 → 2).
 * Java `Math.round` 는 half-up(2.5 → 3) → **대입 전 반드시 `Math.round`** 를 거친다.
 * clamp(0..255) 는 `Uint8ClampedArray` 가 담당(= Java `clamp255` 와 등가).
 */

/** 색보정 파라미터 4개. 전부 -100..100 정수, 0 = 무변화. */
export interface ColorAdjust {
  brightness: number;
  contrast: number;
  saturation: number;
  temperature: number;
}

export const NEUTRAL_ADJUST: ColorAdjust = {
  brightness: 0,
  contrast: 0,
  saturation: 0,
  temperature: 0,
};

export const isNeutral = (a: ColorAdjust) =>
  a.brightness === 0 && a.contrast === 0 && a.saturation === 0 && a.temperature === 0;

/** Null/NaN → 0, 그 외 -100..100 으로 clamp (검증이 아니라 clamp — 백엔드와 동일). */
const clampParam = (v: number) => Math.max(-100, Math.min(100, Math.round(v || 0)));

/** R/G/B 256칸 LUT. 순서 고정: 게인(밝기×색온도) → 대비(0.5 기준). */
export function buildColorLut(a: ColorAdjust): Uint8ClampedArray[] {
  const bGain = 1 + clampParam(a.brightness) / 100;
  const cGain = 1 + clampParam(a.contrast) / 100;
  const tShift = (clampParam(a.temperature) / 100) * 0.2;
  const chGain = [bGain * (1 + tShift), bGain, bGain * (1 - tShift)];
  return chGain.map((gain) => {
    const lut = new Uint8ClampedArray(256);
    for (let v = 0; v < 256; v++) {
      let x = (v / 255) * gain;
      x = (x - 0.5) * cGain + 0.5; // contrast around mid-grey — order is fixed
      lut[v] = Math.round(x * 255); // Uint8ClampedArray 가 0..255 clamp
    }
    return lut;
  });
}

/** RGBA ImageData 버퍼를 제자리 보정(alpha 미변경). 중립이면 아무것도 안 한다. */
export function applyColorAdjust(data: Uint8ClampedArray, a: ColorAdjust): void {
  if (isNeutral(a)) return;
  const lut = buildColorLut(a);
  const s = clampParam(a.saturation);
  const sGain = 1 + s / 100;
  for (let i = 0; i < data.length; i += 4) {
    let r = lut[0][data[i]];
    let g = lut[1][data[i + 1]];
    let b = lut[2][data[i + 2]];
    if (s !== 0) {
      // 채도는 LUT 불가 → LUT 통과값 기준으로 블렌딩(Java 와 같은 순서)
      const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b; // Rec.709
      r = Math.round(lum + (r - lum) * sGain);
      g = Math.round(lum + (g - lum) * sGain);
      b = Math.round(lum + (b - lum) * sGain);
    }
    data[i] = r;
    data[i + 1] = g;
    data[i + 2] = b; // i+3(alpha) 는 건드리지 않는다
  }
}
