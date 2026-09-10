'use client';

import { ChevronDown, ChevronRight } from 'lucide-react';
import type { ReconBlockB as BlockB, ReconLineView } from '@/domain/entities/Settlement';
import { causeLabel, formatMoney, formatSigned } from '@/domain/entities/Settlement';
import { ReconLineTable } from './ReconLineTable';

/**
 * 블록 B — <b>왜 예상보다 적은가</b> (라인 단위, FEATURE_2609_30 / 05 Step 3 · PLAN D12 · D13).
 *
 * 라벨 줄을 누르면 그 라벨의 라인 목록이 <b>인라인으로</b> 펼쳐진다. 모달이 아닌 이유는 사용자가 라벨을
 * 오가며 비교하기 때문이다 — 모달이면 매번 닫았다 열어야 한다.
 *
 * 🔴 <b>항등식</b>: `Σ 라벨 금액 == 총차액`. 잔차(`ROUNDING`)가 나머지를 흡수하므로 설명되지 않은 금액이
 * 사라지지 않는다. 화면에서 라벨을 임의로 감추면 이 항등식이 눈에서 깨진다 — 0원 라벨도 서버가 준 대로 그린다.
 * 🔴 잔차 경고 문구는 <b>서버가 소유</b>한다(`detail`). 20% 판정도 서버가 한다 — 여기서 다시 계산하지 않는다.
 *
 * ⚠️ 부호 규칙: 서버의 `totalDiff = 예상 − 실정산` 이라 <b>양수 = 예상보다 덜 받음</b>이다. 헤더에 이 규칙을
 * 적어 두지 않으면 숫자를 반대로 읽는다.
 * ⚠️ 미분류는 라벨 분해 대상이 아니다(예상이 없다) — 별도 토글로만 본다.
 * 🔴 라벨 0개로 이 컴포넌트가 호출되는 경우는 미분류 보기뿐이다(D9-1) — 그때는 헤더도 미분류 문구로 바꾼다.
 */
interface ReconBlockBProps {
  blockB: BlockB;
  expandedLabel: string;
  unmatchedOnly: boolean;
  lines: ReconLineView[];
  linesLoading: boolean;
  linesError: string;
  onExpand: (label: string) => void;
  onToggleUnmatched: () => void;
  onCopyIdentifiers: (line: ReconLineView) => void;
}

export function ReconBlockB({
  blockB,
  expandedLabel,
  unmatchedOnly,
  lines,
  linesLoading,
  linesError,
  onExpand,
  onToggleUnmatched,
  onCopyIdentifiers,
}: ReconBlockBProps) {
  // 라벨이 없는데 미분류 보기로 열린 화면 — 원인 분해가 아니라 미분류 목록이다(PLAN 2609_32 D9-1).
  const unmatchedView = unmatchedOnly && blockB.labels.length === 0;

  return (
    <section className="bg-white rounded-lg shadow">
      <div className="p-6 space-y-4">
        <div className="flex flex-wrap items-start gap-3">
          <div className="space-y-1">
            <h2 className="text-lg font-semibold text-gray-900">
              {unmatchedView ? '미분류 판매 건' : '차액 원인 분석'}
            </h2>
            <p className="text-sm text-gray-500">
              {unmatchedView ? (
                '예상이 없어 원인 분해 대상이 아닌 판매 건입니다.'
              ) : (
                <>
                  판매 건별 원인 분해입니다. 차액은 <b>예상 − 실정산</b>이라 양수면 예상보다 덜 받은
                  금액입니다.
                </>
              )}
            </p>
          </div>
          <button
            type="button"
            onClick={onToggleUnmatched}
            className={`ml-auto px-3 py-2 text-sm rounded-lg border ${
              unmatchedOnly
                ? 'bg-blue-600 text-white border-blue-600'
                : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-100'
            }`}
          >
            미분류만 보기
          </button>
        </div>

        {!unmatchedView && (
          <div className="flex flex-wrap items-center gap-x-6 gap-y-1 text-sm">
            <span className="text-gray-700">
              예상 <b className="text-gray-900">{formatMoney(blockB.expected)}</b>
            </span>
            <span className="text-gray-400">→</span>
            <span className="text-gray-700">
              실정산 <b className="text-gray-900">{formatMoney(blockB.actual)}</b>
            </span>
            <span className="ml-auto text-gray-700">
              차액 <b className="text-gray-900">{formatSigned(blockB.totalDiff)}</b>
            </span>
          </div>
        )}
      </div>

      {!unmatchedOnly && (
        <div className="border-t border-gray-200">
          {blockB.labels.map((label) => {
            const expanded = expandedLabel === label.label;
            // 잔차 경고는 서버가 `detail` 로 알려준 경우에만 강조한다(20% 판정의 소유자는 서버다).
            const warn = label.label === 'ROUNDING' && Boolean(label.detail);
            return (
              <div key={label.label} className="border-b border-gray-200 last:border-b-0">
                <button
                  type="button"
                  onClick={() => onExpand(label.label)}
                  className={`w-full flex items-center gap-3 px-6 py-3 text-left text-sm hover:bg-gray-50 ${
                    warn ? 'bg-amber-50' : ''
                  }`}
                >
                  {expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                  <span className={warn ? 'text-amber-800 font-medium' : 'text-gray-900'}>
                    {causeLabel(label.label)}
                  </span>
                  <span className={`ml-auto font-medium ${warn ? 'text-amber-800' : 'text-gray-900'}`}>
                    {formatSigned(label.amount)}
                  </span>
                  <span className="w-20 text-right text-gray-500">
                    {label.count.toLocaleString('ko-KR')}건
                  </span>
                </button>
                {/* 서버 소유 문구 — 그대로 출력한다(D13). */}
                {label.detail && (
                  <p
                    className={`px-6 pb-3 text-xs ${warn ? 'text-amber-800' : 'text-gray-500'}`}
                  >
                    {label.detail}
                  </p>
                )}
                {expanded && (
                  <ReconLineTable
                    lines={lines}
                    loading={linesLoading}
                    error={linesError}
                    onCopyIdentifiers={onCopyIdentifiers}
                  />
                )}
              </div>
            );
          })}
        </div>
      )}

      {unmatchedOnly && (
        <ReconLineTable
          lines={lines}
          loading={linesLoading}
          error={linesError}
          onCopyIdentifiers={onCopyIdentifiers}
        />
      )}
    </section>
  );
}
