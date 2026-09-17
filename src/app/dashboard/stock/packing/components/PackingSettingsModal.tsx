'use client';

import { Volume2 } from 'lucide-react';

import { Modal } from '@/presentation/components/ui/Modal';
import { Button } from '@/presentation/components/ui/Button';
import { usePackingSoundStore } from '@/infrastructure/stores/packingSoundStore';
import {
  PACKING_SOUND_EVENTS,
  SOUND_PRESETS,
  playPackingSound,
  unlockAudio,
} from '@/infrastructure/utils/packingSounds';

/**
 * 포장 작업 설정 팝업 — 지금은 **효과음**만 다룬다.
 *
 * **파일**: src/app/dashboard/stock/packing/components/PackingSettingsModal.tsx
 * **여는 곳**: 포장 작업 화면 하단 줄의 [설정] 버튼 하나.
 *
 * 🔴 **저장 버튼이 없다 — 바꾸는 즉시 반영·저장된다**(store 가 localStorage 에 쓴다).
 *    현장에서 소리를 고르는 일은 "듣고 → 바꾸고 → 또 듣고" 라서, 저장을 거치면 미리듣기가
 *    설정과 어긋난다(듣는 소리와 저장될 소리가 다름).
 * 🔴 프리셋을 고르면 **그 자리에서 한 번 들려준다** — 이름만으로는 어떤 소리인지 알 수 없다.
 * 🔴 소리가 안 나면 대개 브라우저가 막은 것이다([작업 시작] 전). 팝업을 열 때 `unlockAudio()`
 *    를 한 번 부른다 — 이 팝업 자체가 사용자 클릭으로 열리므로 여기가 유효한 제스처다.
 */
interface PackingSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function PackingSettingsModal({ isOpen, onClose }: PackingSettingsModalProps) {
  const soundOn = usePackingSoundStore((state) => state.soundOn);
  const volume = usePackingSoundStore((state) => state.volume);
  const sounds = usePackingSoundStore((state) => state.sounds);
  const setSoundOn = usePackingSoundStore((state) => state.setSoundOn);
  const setVolume = usePackingSoundStore((state) => state.setVolume);
  const setEventEnabled = usePackingSoundStore((state) => state.setEventEnabled);
  const setEventPreset = usePackingSoundStore((state) => state.setEventPreset);
  const resetSounds = usePackingSoundStore((state) => state.resetSounds);

  if (isOpen) unlockAudio();

  const preview = (presetId: string) => playPackingSound(presetId, volume);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="포장 작업 설정"
      footer={
        <>
          <Button variant="secondary" onClick={resetSounds}>
            기본값으로
          </Button>
          <Button onClick={onClose}>닫기</Button>
        </>
      }
    >
      <div className="space-y-5">
        <section className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <label className="flex items-center gap-2 text-base font-semibold text-gray-900">
              <input
                type="checkbox"
                className="h-5 w-5"
                checked={soundOn}
                onChange={(event) => setSoundOn(event.target.checked)}
              />
              효과음 사용
            </label>

            <div className="flex items-center gap-2">
              <Volume2 size={18} className="text-gray-700" aria-hidden />
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={volume}
                disabled={!soundOn}
                onChange={(event) => setVolume(Number(event.target.value))}
                onMouseUp={() => preview('beep')}
                aria-label="효과음 음량"
                className="w-40"
              />
              <span className="w-10 text-right text-sm tabular-nums text-gray-700">
                {Math.round(volume * 100)}%
              </span>
            </div>
          </div>
          <p className="text-sm text-gray-700">
            소리는 이 기기에만 저장됩니다. 작업대마다 따로 설정하세요.
          </p>
        </section>

        <section className="space-y-3 border-t border-gray-200 pt-4">
          {PACKING_SOUND_EVENTS.map(({ key, label, hint }) => {
            const setting = sounds[key];
            const disabled = !soundOn || !setting.enabled;
            return (
              <div
                key={key}
                className="flex flex-wrap items-center gap-3 rounded-lg border border-gray-200 p-3"
              >
                <label className="flex min-w-0 flex-1 items-start gap-2">
                  <input
                    type="checkbox"
                    className="mt-1 h-5 w-5 shrink-0"
                    checked={setting.enabled}
                    disabled={!soundOn}
                    onChange={(event) => setEventEnabled(key, event.target.checked)}
                  />
                  <span className="min-w-0">
                    <span className="block text-base font-semibold text-gray-900">{label}</span>
                    <span className="block text-sm text-gray-700">{hint}</span>
                  </span>
                </label>

                <select
                  value={setting.preset}
                  disabled={disabled}
                  onChange={(event) => {
                    setEventPreset(key, event.target.value);
                    // 고른 소리를 바로 들려준다 — 이름만으로는 판단이 안 된다
                    preview(event.target.value);
                  }}
                  aria-label={`${label} 효과음`}
                  className="h-10 w-44 shrink-0 rounded border border-gray-300 px-3 text-sm disabled:bg-gray-100"
                >
                  {SOUND_PRESETS.map((presetOption) => (
                    <option key={presetOption.id} value={presetOption.id}>
                      {presetOption.label}
                    </option>
                  ))}
                </select>

                <Button
                  size="sm"
                  variant="secondary"
                  className="shrink-0"
                  disabled={disabled}
                  onClick={() => preview(setting.preset)}
                >
                  듣기
                </Button>
              </div>
            );
          })}
        </section>
      </div>
    </Modal>
  );
}
