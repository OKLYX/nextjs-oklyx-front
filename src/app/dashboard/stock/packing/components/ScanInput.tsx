'use client';

import { useState, type FormEvent } from 'react';
import { Spinner } from '@/presentation/components/Spinner';

/**
 * 스캔 버퍼 표시 + 수동 입력 대체 창구 (FEATURE_2609_40 / PLAN D9 · D33).
 *
 * 🔴 **키 수신은 이 컴포넌트가 하지 않는다.** 전역 키 수신은 페이지가 하고(어디에 포커스가 있어도
 * 스캔이 잡혀야 한다) 여기는 페이지가 모은 `buffer` 와 안내만 그린다. 버퍼가 두 곳에 있으면
 * 포커스가 벗어났을 때 스캔이 허공으로 간다.
 *
 * 아래의 작은 입력칸은 **스캐너가 없을 때의 수동 입력**이다. 여기서 Enter 를 쳐도 페이지의
 * `onScan` 으로 들어가 스캔과 완전히 같은 규칙(D33)을 탄다.
 */
export interface ScanInputProps {
  mode: 'INVOICE' | 'ITEM';
  /** 페이지가 모으고 있는 전역 스캔 버퍼 */
  buffer: string;
  disabled: boolean;
  onScan: (value: string) => void;
  /** 송장 조회 중 = 스피너 + 입력 차단 */
  isScanning?: boolean;
}

const GUIDE: Record<ScanInputProps['mode'], string> = {
  INVOICE: '송장을 스캔하세요',
  ITEM: '물품을 스캔하세요 · 숫자 4자리 이하 + Enter = 고른 줄 수량 수정',
};

export function ScanInput({ mode, buffer, disabled, onScan, isScanning = false }: ScanInputProps) {
  const [manual, setManual] = useState('');

  const submitManual = (event: FormEvent) => {
    event.preventDefault();
    const value = manual.trim();
    if (!value || disabled) return;
    setManual('');
    onScan(value);
  };

  return (
    <div className="flex items-center gap-4">
      <div
        className={`flex h-14 flex-1 items-center gap-3 rounded-lg border-2 px-4 font-mono text-2xl tracking-wider ${
          disabled ? 'border-gray-200 bg-gray-50 text-gray-400' : 'border-blue-500 bg-white text-gray-900'
        }`}
      >
        {isScanning && <Spinner size={20} />}
        <span className="truncate">{buffer || ' '}</span>
        {!buffer && !isScanning && (
          <span className="font-sans text-sm text-gray-400">{GUIDE[mode]}</span>
        )}
      </div>

      <form onSubmit={submitManual} className="flex items-center gap-2">
        <input
          type="text"
          value={manual}
          onChange={(event) => setManual(event.target.value)}
          disabled={disabled}
          placeholder="직접 입력"
          className="h-10 w-44 rounded border border-gray-300 px-3 text-sm disabled:bg-gray-100"
        />
      </form>
    </div>
  );
}
