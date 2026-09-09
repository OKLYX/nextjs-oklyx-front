'use client';

import { useState } from 'react';
import { Copy } from 'lucide-react';
import { Spinner } from '@/presentation/components/Spinner';
import type { ReconLineView } from '@/domain/entities/Settlement';
import {
  causeLabel,
  formatMoney,
  formatRatio,
  formatSigned,
  settlementTypeLabel,
} from '@/domain/entities/Settlement';

/**
 * 금액 확인 판매 내역 표 (FEATURE_2609_30 / 05 Step 3 블록 B).
 *
 * 🔴 <b>[식별자 복사]가 이 화면의 핵심 동선이다.</b> 이 화면의 목적은 "왜 적나"를 <b>플랫폼에 문의할 수
 * 있는 형태로</b> 보여주는 것이라, 주문번호·옵션ID·인식일·지급일·정산유형을 한 줄로 복사할 수 있어야 한다.
 * 컬럼을 줄일 때도 이 버튼과 식별자 3종은 남긴다.
 *
 * ⚠️ 데이터는 표시 전용이다 — 조회·필터·클립보드 쓰기는 `PayoutDetailContainer` 가 소유한다. 여기서 드는
 * 유일한 상태는 "복사됨" 표시가 잠깐 보이는 것뿐이라 부모로 올릴 이유가 없다.
 * ⚠️ 미분류(`unmatched`)는 실패가 아니다 — 붙일 주문이 없어 <b>예상 자체가 없는</b> 상태이고 합계에는
 * 포함돼 있다(PLAN D7). 그래서 차액이 `—` 로 비어 있는 것이 정상이다.
 */
interface ReconLineTableProps {
  lines: ReconLineView[];
  loading: boolean;
  error: string;
  onCopyIdentifiers: (line: ReconLineView) => void;
}

/** 목록 안에서만 유일하면 되는 표시용 키 — 서버가 판매 건 PK 를 내려주지 않는다. */
const lineKey = (line: ReconLineView, index: number): string =>
  `${line.externalOrderId ?? '-'}|${line.platformOptionId ?? '-'}|${line.recognitionDate ?? '-'}|${index}`;

export function ReconLineTable({ lines, loading, error, onCopyIdentifiers }: ReconLineTableProps) {
  const [copiedKey, setCopiedKey] = useState('');

  if (loading) {
    return (
      <div className="px-6 py-4 text-sm text-gray-500">
        <Spinner label="판매 내역 불러오는 중..." />
      </div>
    );
  }

  if (error) {
    return <div className="px-6 py-4 text-sm text-red-600">{error}</div>;
  }

  if (lines.length === 0) {
    return <div className="px-6 py-4 text-sm text-gray-500">해당하는 판매 건이 없습니다.</div>;
  }

  return (
    <div className="list-table-scroll border-t border-gray-200">
      <table className="w-full">
        <thead className="bg-gray-50">
          <tr className="text-left text-xs font-medium text-gray-500">
            <th className="px-4 py-2">주문번호</th>
            <th className="px-4 py-2">옵션ID</th>
            <th className="px-4 py-2">상품명</th>
            <th className="px-4 py-2">인식일</th>
            <th className="px-4 py-2">지급일</th>
            <th className="px-4 py-2">정산유형</th>
            <th className="px-4 py-2 text-right">판매금액</th>
            <th className="px-4 py-2 text-right">수수료</th>
            <th className="px-4 py-2 text-right">실수수료율</th>
            <th className="px-4 py-2 text-right">정산액</th>
            <th className="px-4 py-2 text-right">차액</th>
            <th className="px-4 py-2" aria-label="식별자 복사" />
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200 text-sm text-gray-900">
          {lines.map((line, index) => {
            const key = lineKey(line, index);
            return (
              <tr key={key} className={line.unmatched ? 'bg-gray-50' : undefined}>
                <td className="px-4 py-2 whitespace-nowrap">{line.externalOrderId ?? '—'}</td>
                <td className="px-4 py-2 whitespace-nowrap">{line.platformOptionId ?? '—'}</td>
                <td className="px-4 py-2">
                  {line.productName ?? '—'}
                  {line.unmatched && (
                    <span className="ml-2 text-xs text-gray-500">미분류 · 합계 포함</span>
                  )}
                  {!line.unmatched && line.label !== 'NONE' && (
                    <span className="ml-2 text-xs text-gray-500">{causeLabel(line.label)}</span>
                  )}
                </td>
                <td className="px-4 py-2 whitespace-nowrap">{line.recognitionDate ?? '—'}</td>
                <td className="px-4 py-2 whitespace-nowrap">{line.settlementDate ?? '—'}</td>
                <td className="px-4 py-2 whitespace-nowrap">
                  {settlementTypeLabel(line.settlementType)}
                </td>
                <td className="px-4 py-2 text-right">{formatMoney(line.saleAmount)}</td>
                <td className="px-4 py-2 text-right">{formatMoney(line.serviceFee)}</td>
                <td className="px-4 py-2 text-right">{formatRatio(line.serviceFeeRatio)}</td>
                <td className="px-4 py-2 text-right">{formatMoney(line.settlementAmount)}</td>
                <td className="px-4 py-2 text-right">{formatSigned(line.diff)}</td>
                <td className="px-4 py-2 text-right whitespace-nowrap">
                  <button
                    type="button"
                    onClick={() => {
                      onCopyIdentifiers(line);
                      setCopiedKey(key);
                    }}
                    className="inline-flex items-center gap-1 px-2 py-1 text-xs border border-gray-300 rounded hover:bg-gray-100"
                  >
                    <Copy size={12} />
                    {copiedKey === key ? '복사됨' : '식별자 복사'}
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
