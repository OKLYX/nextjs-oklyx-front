import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

import type { PackingSoundEvent } from '@/infrastructure/utils/packingSounds';

/**
 * 포장 작업 효과음 설정 store.
 *
 * **용도**: 스캔 이벤트 5종의 소리 on/off·프리셋·전체 음량을 한 곳에서 관리 + localStorage 영속.
 * **파일**: src/infrastructure/stores/packingSoundStore.ts
 * **설정 창구**: 포장 작업 화면의 [설정] 팝업 하나뿐이다.
 *
 * 🔴 **기기별 설정이다**(localStorage) — 서버에 올리지 않는다. 작업장 PC 마다 스피커·소음이
 *    달라서 한 사람의 설정을 다른 작업대에 강제하면 안 된다.
 * 🔴 소리 프리셋은 **id 문자열**로만 저장한다. 파형·주파수는 `packingSounds.ts` 가 소유한다 —
 *    저장값에 구우면 프리셋을 고칠 때 기존 설정이 옛 소리에 묶인다.
 *
 * **사용 예제**:
 *   const sounds = usePackingSoundStore((s) => s.sounds);
 *   playPackingSound(sounds.itemScan.preset, volume);
 */
export interface PackingSoundSetting {
  enabled: boolean;
  preset: string;
}

type SoundMap = Record<PackingSoundEvent, PackingSoundSetting>;

/** 기본값 = 이벤트마다 확실히 다른 소리. 중요한 사건일수록 길고 낮게 시작한다 */
const DEFAULT_SOUNDS: SoundMap = {
  invoiceScan: { enabled: true, preset: 'beepLow' },
  itemScan: { enabled: true, preset: 'beep' },
  itemDone: { enabled: true, preset: 'double' },
  allDone: { enabled: true, preset: 'chime' },
  parcelComplete: { enabled: true, preset: 'fanfare' },
};

interface PackingSoundStore {
  /** 전체 끄기 — 개별 설정을 건드리지 않고 한 번에 조용히 한다 */
  soundOn: boolean;
  volume: number;
  sounds: SoundMap;
  setSoundOn: (on: boolean) => void;
  setVolume: (volume: number) => void;
  setEventEnabled: (event: PackingSoundEvent, enabled: boolean) => void;
  setEventPreset: (event: PackingSoundEvent, preset: string) => void;
  resetSounds: () => void;
}

export const usePackingSoundStore = create<PackingSoundStore>()(
  persist(
    (set) => ({
      soundOn: true,
      volume: 0.35,
      sounds: DEFAULT_SOUNDS,
      setSoundOn: (soundOn) => set({ soundOn }),
      setVolume: (volume) => set({ volume: Math.min(1, Math.max(0, volume)) }),
      setEventEnabled: (event, enabled) =>
        set((state) => ({
          sounds: { ...state.sounds, [event]: { ...state.sounds[event], enabled } },
        })),
      setEventPreset: (event, preset) =>
        set((state) => ({
          sounds: { ...state.sounds, [event]: { ...state.sounds[event], preset } },
        })),
      resetSounds: () => set({ soundOn: true, volume: 0.35, sounds: DEFAULT_SOUNDS }),
    }),
    {
      name: 'packing-sound-storage',
      storage: createJSONStorage(() => localStorage),
      version: 1,
      /**
       * 🔴 저장된 값에 **이벤트가 빠져 있어도** 기본값으로 메운다 — 이벤트를 새로 추가했을 때
       * 기존 사용자의 저장값에는 그 키가 없어 `sounds[event]` 가 undefined 가 되고, 소리를 내는
       * 쪽에서 터진다.
       */
      merge: (persisted, current) => {
        const saved = persisted as Partial<PackingSoundStore> | undefined;
        return {
          ...current,
          ...saved,
          sounds: { ...DEFAULT_SOUNDS, ...(saved?.sounds ?? {}) },
        };
      },
    }
  )
);
