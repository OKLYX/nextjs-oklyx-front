/**
 * 포장 작업 효과음 — **Web Audio 합성**(오디오 파일 없음).
 *
 * **파일**: src/infrastructure/utils/packingSounds.ts
 * **쓰는 곳**: 포장 작업 화면(`app/dashboard/stock/packing/`)의 스캔 이벤트 5종 + 설정 팝업 미리듣기.
 *
 * 🔴 **음원 파일을 쓰지 않는다.** 소리가 짧은 신호음뿐이라 합성으로 충분하고, 파일을 두면
 *    ① 저장소에 바이너리가 쌓이고 ② 네트워크로 받아야 해서 **첫 스캔이 무음**이 된다.
 *    작업자는 손이 바쁜 상태로 소리에 의존하므로 지연이 있으면 쓸모가 없다.
 * 🔴 **`AudioContext` 는 사용자 제스처 뒤에만 소리를 낸다**(브라우저 자동재생 정책).
 *    포장 화면은 [작업 시작] 버튼이 그 제스처다 — 거기서 `unlockAudio()` 를 부른다.
 *    안 부르면 컨텍스트가 `suspended` 로 남아 **아무 소리도 안 나는데 에러도 없다**.
 * 🔴 컨텍스트는 **하나만** 만들어 재사용한다. 스캔마다 새로 만들면 몇십 번 만에 브라우저가 막는다.
 */

/** 이벤트 5종 — 화면이 이 키로 설정을 찾고 소리를 낸다 */
export type PackingSoundEvent =
  | 'invoiceScan'
  | 'itemScan'
  | 'itemDone'
  | 'allDone'
  | 'parcelComplete';

export const PACKING_SOUND_EVENTS: { key: PackingSoundEvent; label: string; hint: string }[] = [
  { key: 'invoiceScan', label: '송장 스캔', hint: '송장을 읽어 박스를 열었을 때' },
  { key: 'itemScan', label: '물품 스캔', hint: '물품 하나를 담았을 때' },
  { key: 'itemDone', label: '물품 하나 완료', hint: '그 물품의 필요 수량을 다 채웠을 때' },
  { key: 'allDone', label: '전부 담음', hint: '이 박스에 담을 것을 다 담아 완료할 수 있을 때' },
  { key: 'parcelComplete', label: '박스 완료', hint: '[이 박스 완료] 가 성공했을 때' },
];

/** 한 음 = 주파수(Hz) + 길이(초). 여러 개를 이어 붙여 한 소리를 만든다 */
interface Tone {
  hz: number;
  sec: number;
}

export interface SoundPreset {
  id: string;
  label: string;
  tones: Tone[];
  /** 사각파는 삑 소리(스캐너 느낌), 사인파는 둥근 소리 */
  wave: OscillatorType;
}

/**
 * 프리셋 — 🔴 **서로 확실히 구분되는 것만** 둔다. 비슷한 소리를 여러 개 두면 작업자가
 * 소리로 사건을 구분하지 못해 효과음 자체가 무의미해진다.
 */
export const SOUND_PRESETS: SoundPreset[] = [
  { id: 'beep', label: '삑 (짧게)', wave: 'square', tones: [{ hz: 1200, sec: 0.07 }] },
  { id: 'beepLow', label: '삑 (낮게)', wave: 'square', tones: [{ hz: 620, sec: 0.09 }] },
  { id: 'double', label: '삑삑 (두 번)', wave: 'square', tones: [{ hz: 1100, sec: 0.06 }, { hz: 0, sec: 0.05 }, { hz: 1100, sec: 0.06 }] },
  { id: 'rise', label: '올라가는 음', wave: 'sine', tones: [{ hz: 760, sec: 0.08 }, { hz: 1140, sec: 0.12 }] },
  { id: 'fall', label: '내려가는 음', wave: 'sine', tones: [{ hz: 1140, sec: 0.08 }, { hz: 760, sec: 0.12 }] },
  { id: 'chime', label: '딩동 (완료)', wave: 'sine', tones: [{ hz: 880, sec: 0.11 }, { hz: 1320, sec: 0.22 }] },
  { id: 'fanfare', label: '딩디딩 (성공)', wave: 'sine', tones: [{ hz: 660, sec: 0.09 }, { hz: 880, sec: 0.09 }, { hz: 1320, sec: 0.26 }] },
  { id: 'tick', label: '똑 (아주 짧게)', wave: 'triangle', tones: [{ hz: 1600, sec: 0.04 }] },
];

export const soundLabel = (id: string): string =>
  SOUND_PRESETS.find((preset) => preset.id === id)?.label ?? id;

let context: AudioContext | null = null;

/** 🔴 [작업 시작] 처럼 **사용자가 누른 직후**에만 부른다 — 그 전엔 브라우저가 소리를 막는다 */
export function unlockAudio(): void {
  if (typeof window === 'undefined') return;
  try {
    if (!context) {
      const Ctor = window.AudioContext ?? (window as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return;
      context = new Ctor();
    }
    if (context.state === 'suspended') void context.resume();
  } catch {
    // 오디오를 못 쓰는 환경이어도 포장 작업 자체는 계속돼야 한다
  }
}

/**
 * 소리 하나를 낸다. `volume` 은 0~1.
 *
 * ⚠️ 실패해도 **조용히 지나간다** — 소리는 보조 신호이고, 여기서 예외가 나면 그 스캔이 통째로 막힌다.
 */
export function playPackingSound(presetId: string, volume: number): void {
  if (volume <= 0) return;
  const preset = SOUND_PRESETS.find((item) => item.id === presetId);
  if (!preset) return;
  unlockAudio();
  if (!context || context.state !== 'running') return;

  try {
    let at = context.currentTime;
    preset.tones.forEach((tone) => {
      if (tone.hz > 0) {
        const osc = context!.createOscillator();
        const gain = context!.createGain();
        osc.type = preset.wave;
        osc.frequency.value = tone.hz;
        // 시작·끝을 깎지 않으면 '툭' 하는 잡음이 난다
        gain.gain.setValueAtTime(0, at);
        gain.gain.linearRampToValueAtTime(volume, at + 0.01);
        gain.gain.setValueAtTime(volume, at + tone.sec - 0.02);
        gain.gain.linearRampToValueAtTime(0, at + tone.sec);
        osc.connect(gain).connect(context!.destination);
        osc.start(at);
        osc.stop(at + tone.sec);
      }
      at += tone.sec;
    });
  } catch {
    // 위와 같은 이유 — 조용히 넘어간다
  }
}
