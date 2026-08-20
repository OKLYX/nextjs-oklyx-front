'use client';

import { useState, type ClipboardEvent, type KeyboardEvent } from 'react';

interface TagChipsInputProps {
  tags: string[];
  onChange: (tags: string[]) => void;
  disabled?: boolean;
  placeholder?: string;
}

/**
 * 태그 칩 입력 공통 컴포넌트 (마스터 태그 풀 · 채널 raw 태그 양쪽 재사용).
 * File: src/presentation/components/TagChipsInput.tsx
 *
 * 부모가 tags 상태를 소유하고 onChange 로 위임받는 controlled 컴포넌트. 외부 태그
 * 라이브러리 없이 hand-rolled 이며, Zustand/RHF 를 쓰지 않는다.
 *
 * 동작:
 * - Enter 또는 콤마(,) 입력 → trim 후 공백/중복(대소문자 정확 일치) 스킵하고 추가
 * - 각 태그는 칩 + × 버튼(해당 인덱스 제거)
 * - 입력이 빈 상태에서 Backspace → 마지막 칩 제거
 * - disabled 시 입력·× 비활성
 *
 * 백엔드가 순서유지 dedup·blank 제거를 하므로 여기 스킵은 UX 미러일 뿐 강제는 아니다.
 * 빈 리스트 저장(=태그 제거)은 허용된다.
 *
 * @example
 * const [tags, setTags] = useState<string[]>([]);
 * <TagChipsInput tags={tags} onChange={setTags} placeholder="태그 입력 후 Enter" />
 *
 * @example
 * <TagChipsInput tags={tags} onChange={setTags} disabled={isSaving} />
 */
export function TagChipsInput({ tags, onChange, disabled = false, placeholder }: TagChipsInputProps) {
  const [draft, setDraft] = useState('');

  // Split on commas (and newlines) so a pasted "a, b, c" string becomes multiple tags.
  // Order-preserving dedup against existing tags and within the batch itself.
  const addTokens = (raw: string) => {
    const next = [...tags];
    for (const token of raw.split(/[,\n]/)) {
      const value = token.trim();
      if (value !== '' && !next.includes(value)) next.push(value);
    }
    if (next.length !== tags.length) onChange(next);
  };

  const commit = () => {
    addTokens(draft);
    setDraft('');
  };

  const removeAt = (index: number) => {
    onChange(tags.filter((_, i) => i !== index));
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      commit();
      return;
    }
    if (e.key === 'Backspace' && draft === '' && tags.length > 0) {
      e.preventDefault();
      removeAt(tags.length - 1);
    }
  };

  const handlePaste = (e: ClipboardEvent<HTMLInputElement>) => {
    const text = e.clipboardData.getData('text');
    if (!/[,\n]/.test(text)) return; // no delimiter -> let the input handle it normally
    e.preventDefault();
    addTokens(draft + text);
    setDraft('');
  };

  return (
    <div className="flex flex-wrap items-center gap-1.5 rounded border border-gray-300 px-2 py-1.5">
      {tags.map((tag, index) => (
        <span
          key={`${tag}-${index}`}
          className="inline-flex items-center gap-1 rounded bg-gray-100 px-2 py-0.5 text-sm text-gray-800"
        >
          {tag}
          <button
            type="button"
            onClick={() => removeAt(index)}
            disabled={disabled}
            className="text-gray-500 hover:text-gray-800 disabled:opacity-50"
            aria-label={`${tag} 태그 제거`}
          >
            ×
          </button>
        </span>
      ))}
      <input
        className="min-w-24 flex-1 border-none px-1 py-0.5 text-sm text-gray-900 outline-none disabled:opacity-50"
        value={draft}
        disabled={disabled}
        placeholder={placeholder ?? '태그 입력 후 Enter'}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={handleKeyDown}
        onPaste={handlePaste}
        onBlur={commit}
      />
    </div>
  );
}
