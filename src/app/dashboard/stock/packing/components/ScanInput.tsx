'use client';

import { Spinner } from '@/presentation/components/Spinner';

/**
 * 스캔 버퍼 표시 (FEATURE_2609_40 / PLAN D9 · D33).
 *
 * 🔴 **키 수신은 이 컴포넌트가 하지 않는다.** 전역 키 수신은 페이지가 하고(어디에 포커스가 있어도
 * 스캔이 잡혀야 한다) 여기는 페이지가 모은 `buffer` 와 안내만 그린다. 버퍼가 두 곳에 있으면
 * 포커스가 벗어났을 때 스캔이 허공으로 간다.
 *
 * 🔴 **「직접 입력」 칸을 다시 만들지 말 것**(2026-09-16 사용자 지적). 스캐너가 없어도 그냥
 * 키보드로 치면 페이지의 전역 키 수신이 받아 여기 버퍼에 쌓이고, Enter 가 스캔과 **완전히 같은**
 * 규칙(D33)을 탄다. 입력칸을 따로 두면 ① 같은 일을 하는 창구가 둘이 되고 ② 그 칸에 포커스가
 * 있는 동안은 전역 수신이 꺼져서(`isFormField` 가드) 오히려 스캐너 입력을 흘린다.
 */
export interface ScanInputProps {
  mode: 'INVOICE' | 'ITEM';
  /** 페이지가 모으고 있는 전역 스캔 버퍼 */
  buffer: string;
  disabled: boolean;
  /** 송장 조회 중 = 스피너 + 입력 차단 */
  isScanning?: boolean;
}

const GUIDE: Record<ScanInputProps['mode'], string> = {
  INVOICE: '송장 바코드를 스캔하거나 키보드로 입력하고 Enter',
  ITEM: '물품을 스캔하세요 · 숫자 4자리 이하 + Enter = 고른 줄 수량 수정',
};

export function ScanInput({ mode, buffer, disabled, isScanning = false }: ScanInputProps) {
  return (
    <div
      className={`flex h-14 items-center gap-3 rounded-lg border-2 px-4 font-mono text-2xl tracking-wider ${
        disabled ? 'border-gray-200 bg-gray-50 text-gray-600' : 'border-blue-500 bg-white text-gray-900'
      }`}
    >
      {isScanning && <Spinner size={20} />}
      <span className="truncate">{buffer || ' '}</span>
      {!buffer && !isScanning && (
        <span className="font-sans text-sm text-gray-600">{GUIDE[mode]}</span>
      )}
    </div>
  );
}
