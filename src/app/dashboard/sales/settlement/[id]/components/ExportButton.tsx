'use client';

import { Download } from 'lucide-react';
import { Spinner } from '@/presentation/components/Spinner';

/**
 * 금액 확인 판매 내역 엑셀 내보내기 버튼 (FEATURE_2609_30 / 05 Step 3).
 *
 * ⚠️ per-action 스피너 — 이 버튼만 비활성이고 리포트는 그대로 볼 수 있다.
 * ⚠️ 실패는 화면 상태를 바꾸지 않는다(부모가 안내만 띄운다) — 다운로드 실패로 리포트가 사라지면 안 된다.
 */
interface ExportButtonProps {
  payoutId: number;
  exporting: boolean;
  onExport: () => void;
}

export function ExportButton({ payoutId, exporting, onExport }: ExportButtonProps) {
  return (
    <button
      type="button"
      onClick={onExport}
      disabled={exporting}
      title={`지급 묶음 #${payoutId} 판매 내역 내보내기`}
      className="inline-flex items-center gap-2 px-4 py-2 text-sm bg-white text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-100 disabled:opacity-50"
    >
      {exporting ? (
        <Spinner label="다운로드 중..." />
      ) : (
        <>
          <Download size={16} />
          엑셀 다운로드
        </>
      )}
    </button>
  );
}
