'use client';

import type { ReactNode } from 'react';
import type { Inquiry, InquiryReply } from '@/domain/entities/InquiryEntity';
import { Card } from '@/presentation/components/ui/Card';

interface InquiryThreadProps {
  inquiry: Inquiry;
  /**
   * 스레드 말풍선 아래에 그대로 렌더되는 슬롯 — 답변 컴포저가 들어온다(05).
   * ⚠️ 스레드는 표시 전용이다. `capability`·`onSend` 를 받아 컴포저를 여기서 만들지 않는다.
   */
  footer?: ReactNode;
}

// 말풍선 시각 — yyyy-MM-dd HH:mm (null/파싱 실패는 원문 그대로).
function formatDateTime(value: string | null): string {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(
    date.getHours()
  )}:${pad(date.getMinutes())}`;
}

function replyAuthorLabel(reply: InquiryReply): string {
  if (reply.authorRole === 'SELLER') return '판매자';
  return reply.authorName ? `쿠팡 상담사 ${reply.authorName}` : '쿠팡 상담사';
}

function Bubble({
  author,
  content,
  at,
  align,
  tone,
}: {
  author: string;
  content: string;
  at: string | null;
  align: 'left' | 'right';
  tone: string;
}) {
  return (
    <div className={`flex ${align === 'right' ? 'justify-end' : 'justify-start'}`}>
      <div className="max-w-[85%] min-w-0">
        <p
          className={`text-xs text-gray-500 mb-1 ${align === 'right' ? 'text-right' : 'text-left'}`}
        >
          {author}
        </p>
        {/* 줄바꿈을 살리고, 긴 문자열이 레이아웃을 밀지 않게 한다. */}
        <div className={`rounded-lg px-4 py-3 text-sm whitespace-pre-wrap break-words ${tone}`}>
          {content}
        </div>
        <p
          className={`text-xs text-gray-400 mt-1 ${align === 'right' ? 'text-right' : 'text-left'}`}
        >
          {formatDateTime(at)}
        </p>
      </div>
    </div>
  );
}

/**
 * 문의 스레드 — 문의 본문(맨 위) → 답변들.
 *
 * ⚠️ `replies` 는 서버가 `replied_at ASC` 로 정렬해 준다(01). 클라이언트에서 다시 정렬하지 않는다.
 */
export function InquiryThread({ inquiry, footer }: InquiryThreadProps) {
  const replies = inquiry.replies ?? [];

  return (
    <Card className="space-y-4">
      <h2 className="text-base font-semibold text-gray-900">문의 내용</h2>

      <Bubble
        author="고객"
        content={inquiry.content}
        at={inquiry.inquiredAt}
        align="left"
        tone="bg-gray-100 text-gray-900"
      />

      {replies.length === 0 ? (
        <p className="text-sm text-gray-500 text-center py-4">아직 답변이 없습니다.</p>
      ) : (
        replies.map((reply) => (
          <Bubble
            key={reply.id}
            author={replyAuthorLabel(reply)}
            content={reply.content}
            at={reply.repliedAt}
            align={reply.authorRole === 'SELLER' ? 'right' : 'left'}
            tone={
              reply.authorRole === 'SELLER'
                ? 'bg-blue-50 text-gray-900'
                : 'bg-amber-50 text-gray-900'
            }
          />
        ))
      )}

      {footer}
    </Card>
  );
}
