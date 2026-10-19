'use client';

import type { FirstMonthQuestion } from '@/domain/entities/Settlement';
import { monthLabel } from '@/domain/entities/Settlement';
import { Button } from '@/presentation/components/ui/Button';

/**
 * 11st server-fee first-month questions — one yellow row per waiting link at the top of 「정산 내역」
 * (FEATURE_2610_20 / D45 ⑦).
 *
 * 🔴 Display only: the container loads the questions on mount (a local read — no market call) and sends the answer.
 * An answered row disappears because the container reloads the list.
 */
interface FirstMonthQuestionBarProps {
  questions: FirstMonthQuestion[];
  /** The link being answered — both of its buttons are disabled. */
  answeringLinkId: number | null;
  /** Answer failure text. Empty = hidden. */
  error: string;
  onAnswer: (linkId: number, charged: boolean) => void;
}

/** 「{채널 이름} 11번가 채널: 지난달(2026년 9월) 11번가 구매확정액이 500만 원 이상이었나요?」 (D45 ⑦). */
export const firstMonthQuestionText = (question: FirstMonthQuestion): string => {
  const channel = question.accountAlias?.trim() ? question.accountAlias : `채널 #${question.accountId}`;
  return `${channel} 11번가 채널: 지난달(${monthLabel(question.askMonth)}) 11번가 구매확정액이 500만 원 이상이었나요?`;
};

export function FirstMonthQuestionBar({
  questions,
  answeringLinkId,
  error,
  onAnswer,
}: FirstMonthQuestionBarProps) {
  if (questions.length === 0 && !error) return null;

  return (
    <div className="space-y-2">
      {questions.map((question) => (
        <div
          key={question.linkId}
          className="flex flex-wrap items-center gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900"
        >
          <span className="flex-1">{firstMonthQuestionText(question)}</span>
          <Button
            size="sm"
            onClick={() => onAnswer(question.linkId, true)}
            disabled={answeringLinkId === question.linkId}
          >
            예
          </Button>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => onAnswer(question.linkId, false)}
            disabled={answeringLinkId === question.linkId}
          >
            아니오
          </Button>
        </div>
      ))}
      {error && (
        <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-4 py-2">{error}</p>
      )}
    </div>
  );
}
