'use client';

import { useState } from 'react';
import { Modal } from '@/presentation/components/ui/Modal';
import { Button } from '@/presentation/components/ui/Button';
import { resolveThumbUrl } from '@/infrastructure/utils/thumbUrl';
import type { ClipItem, ClipValues } from '@/domain/entities/ClipItem';

/**
 * [클립보드에서 채우기] 를 누르면 뜨는 선택 팝업 (FEATURE_2609_62 후속).
 *
 * **용도**: 담긴 물품이 여럿일 때 **어느 물품에서** 채울지, 그중 **어느 항목을** 채울지 고른다.
 * **파일**: src/app/dashboard/products/[id]/components/ClipboardFillModal.tsx
 *
 * **왜 팝업인가**: 이전에는 가장 최근에 담은 물품으로 빈 칸을 말없이 채웠다. 담긴 물품이
 *   여럿이면 어느 것이 들어오는지 화면에 드러나지 않아, 사용자가 A 를 담고 나중에 B 를 담으면
 *   의도와 다른 값이 들어가도 알 수 없었다.
 *
 * **덮어쓰기 규칙 — 여기가 이전과 다르다**
 * - 체크한 항목은 **기존 값이 있어도 덮어쓴다**(일부러 고른 것이므로).
 * - 대신 이미 값이 있는 항목은 **처음에 체크가 꺼져 있고**, `현재 값 → 새 값` 으로 보여준다.
 *   무엇을 잃는지 보이지 않은 채 덮이는 일이 없어야 한다.
 * - 담긴 값이 없는 항목은 고를 수 없다(채울 것이 없다).
 *
 * **사용 예제** — 열려 있을 때만 렌더한다(닫을 때마다 선택이 초기화되어야 한다):
 * ```tsx
 * {isFillOpen && (
 *   <ClipboardFillModal
 *     clips={productClips}
 *     currentValues={formValues}
 *     onApply={handleApplyFill}
 *     onClose={() => setIsFillOpen(false)}
 *   />
 * )}
 * ```
 *
 * 🔴 썸네일은 `resolveThumbUrl(imageUrl)` 로 렌더한다. 대표 프록시 `getImageUrl` 금지
 *   (`ClipboardTool` 과 같은 규칙).
 * ⚠️ 물품을 바꾸면 체크 상태도 그 물품 기준으로 **다시 잡는다** — 이전 물품 기준으로 고른
 *   체크가 남으면 "담긴 값 없음" 항목이 체크된 채로 보인다.
 * ⚠️ 물품을 바꿀 때 `useEffect` 로 체크를 갱신하지 말 것 — 이 저장소 lint 규칙
 *   `react-hooks/set-state-in-effect`(error) 에 걸린다. 선택 핸들러 안에서 함께 갱신한다.
 * ❌ 값이 없는 항목을 체크 가능하게 두지 말 것 — 눌러도 아무 일이 없는 체크박스가 된다.
 */

/** 값 스냅샷을 가진 항목(사진 한 장짜리 항목에는 채울 값이 없다). */
export type ProductClip = Extract<ClipItem, { kind: 'product' }>;

/**
 * 채우기 대상 9개 항목의 표시 이름 — 순서가 곧 팝업에 나오는 순서다.
 *
 * 🔴 상품명·바코드는 여기에 없다. `ClipValues` 자체에 없는 값이라 채울 수 없다
 *   (바코드는 복제하면 중복이 생기고, 상품명은 물품을 구분하는 이름이다).
 */
export const CLIP_FIELD_LABELS: Record<keyof ClipValues, string> = {
  brand: '브랜드',
  store: '구매처',
  price: '가격',
  netContent: '내용물 양',
  netContentUnit: '단위',
  packageWidth: '너비',
  packageLength: '길이',
  packageHeight: '높이',
  description: '설명',
};

const FIELD_ORDER = Object.keys(CLIP_FIELD_LABELS) as (keyof ClipValues)[];

const isBlank = (value: string | undefined | null): boolean => value == null || value === '';

/**
 * 물품을 고른 순간의 기본 체크 — **담긴 값이 있고, 지금 폼이 비어 있는** 항목만 켠다.
 *
 * 이미 값이 있는 항목을 기본으로 켜면 팝업을 열고 [채우기] 만 눌러도 기존 값이 날아간다.
 */
function defaultKeys(
  clip: ProductClip,
  currentValues: Record<keyof ClipValues, string>,
): Set<keyof ClipValues> {
  const picked = new Set<keyof ClipValues>();
  FIELD_ORDER.forEach((key) => {
    if (isBlank(clip.values[key])) return;
    if (!isBlank(currentValues[key])) return;
    picked.add(key);
  });
  return picked;
}

interface ClipboardFillModalProps {
  /** 담긴 물품 목록(최근 것이 앞). 비어 있으면 호출부가 버튼 자체를 막는다. */
  clips: ProductClip[];
  /** 지금 폼에 들어 있는 값 — 덮어쓰기 여부 표시와 기본 체크 판단에 쓴다. */
  currentValues: Record<keyof ClipValues, string>;
  /** [채우기] — 고른 물품의 값과 고른 항목만 넘긴다. 폼 반영은 호출부가 한다. */
  onApply: (values: ClipValues, keys: (keyof ClipValues)[]) => void;
  onClose: () => void;
}

export function ClipboardFillModal({
  clips,
  currentValues,
  onApply,
  onClose,
}: ClipboardFillModalProps) {
  const [clipId, setClipId] = useState(clips[0]?.clipId ?? '');
  const selected = clips.find((clip) => clip.clipId === clipId) ?? clips[0];
  const [keys, setKeys] = useState<Set<keyof ClipValues>>(() =>
    selected ? defaultKeys(selected, currentValues) : new Set(),
  );

  if (!selected) return null;

  // 물품 선택과 체크 갱신은 한 핸들러 안에서 함께 일어난다(위 ⚠️ lint 규칙).
  const pickClip = (next: ProductClip) => {
    setClipId(next.clipId);
    setKeys(defaultKeys(next, currentValues));
  };

  const toggleKey = (key: keyof ClipValues) => {
    setKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  /** 담긴 값이 있는 항목만 고를 수 있다. */
  const fillable = FIELD_ORDER.filter((key) => !isBlank(selected.values[key]));
  const overwriting = [...keys].filter((key) => !isBlank(currentValues[key]));

  const thumbOf = (clip: ProductClip): string | null => {
    const first = clip.imageRefs[0];
    return first ? resolveThumbUrl(first.imageUrl) : null;
  };

  const summaryOf = (clip: ProductClip): string => {
    const valueCount = Object.values(clip.values).filter((value) => !isBlank(value)).length;
    return `사진 ${clip.imageRefs.length}장 · 값 ${valueCount}개`;
  };

  return (
    <Modal
      isOpen
      onClose={onClose}
      title="클립보드에서 채우기"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            취소
          </Button>
          <Button onClick={() => onApply(selected.values, [...keys])} disabled={keys.size === 0}>
            {keys.size === 0 ? '채우기' : `${keys.size}개 항목 채우기`}
          </Button>
        </>
      }
    >
      <div className="space-y-6">
        {/* 1층 — 어느 물품에서 채울지 */}
        <section>
          <h3 className="mb-2 text-sm font-semibold text-gray-900">
            어느 물품에서 채울까요?
          </h3>
          {clips.length === 1 ? (
            <p className="mb-2 text-xs text-gray-500">담긴 물품이 하나입니다.</p>
          ) : (
            <p className="mb-2 text-xs text-gray-500">
              담긴 물품 {clips.length}개 중 하나를 고릅니다. 바꾸면 아래 체크도 다시 잡힙니다.
            </p>
          )}
          <div className="space-y-1">
            {clips.map((clip, index) => {
              const thumb = thumbOf(clip);
              const checked = clip.clipId === selected.clipId;
              return (
                <label
                  key={clip.clipId}
                  className={`flex cursor-pointer items-center gap-3 rounded-lg border p-2 ${
                    checked ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  <input
                    type="radio"
                    name="clipboard-fill-source"
                    checked={checked}
                    onChange={() => pickClip(clip)}
                    className="shrink-0"
                  />
                  <div className="h-10 w-10 shrink-0 overflow-hidden rounded bg-gray-100">
                    {thumb && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={thumb}
                        alt=""
                        className="h-full w-full object-contain"
                      />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-gray-900">
                      {clip.productName}
                      {index === 0 && (
                        <span className="ml-2 rounded bg-gray-200 px-1.5 py-0.5 text-[10px] font-medium text-gray-700">
                          최근
                        </span>
                      )}
                    </p>
                    <p className="text-xs text-gray-500">{summaryOf(clip)}</p>
                  </div>
                </label>
              );
            })}
          </div>
        </section>

        {/* 2층 — 어느 항목을 채울지 */}
        <section>
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-900">채울 항목</h3>
            {fillable.length > 0 && (
              <div className="flex gap-2 text-xs">
                <button
                  type="button"
                  onClick={() => setKeys(new Set(fillable))}
                  className="text-blue-600 hover:underline"
                >
                  전체 선택
                </button>
                <button
                  type="button"
                  onClick={() => setKeys(new Set())}
                  className="text-gray-500 hover:underline"
                >
                  전체 해제
                </button>
              </div>
            )}
          </div>

          {fillable.length === 0 ? (
            <p className="rounded-lg bg-gray-50 px-3 py-2 text-sm text-gray-600">
              이 물품에 담긴 값이 없습니다.
            </p>
          ) : (
            <div className="space-y-1">
              {FIELD_ORDER.map((key) => {
                const incoming = selected.values[key];
                const current = currentValues[key] ?? '';
                const hasIncoming = !isBlank(incoming);
                const willOverwrite = !isBlank(current);
                const checked = keys.has(key);
                return (
                  <label
                    key={key}
                    className={`flex items-start gap-3 rounded-lg border p-2 ${
                      hasIncoming
                        ? 'cursor-pointer border-gray-200 hover:bg-gray-50'
                        : 'border-gray-100 bg-gray-50'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      disabled={!hasIncoming}
                      onChange={() => toggleKey(key)}
                      className="mt-0.5 shrink-0"
                    />
                    <div className="min-w-0 flex-1">
                      <p
                        className={`text-sm font-medium ${
                          hasIncoming ? 'text-gray-900' : 'text-gray-400'
                        }`}
                      >
                        {CLIP_FIELD_LABELS[key]}
                      </p>
                      {!hasIncoming ? (
                        <p className="text-xs text-gray-400">담긴 값 없음</p>
                      ) : willOverwrite ? (
                        // 무엇을 잃는지 보이게 한다 — 체크하면 이 값이 덮인다.
                        <p className="text-xs text-gray-600">
                          <span className="text-red-600 line-through">{current}</span>
                          <span className="mx-1 text-gray-400">→</span>
                          <span className="font-medium text-gray-900">{incoming}</span>
                        </p>
                      ) : (
                        <p className="truncate text-xs text-gray-600">{incoming}</p>
                      )}
                    </div>
                  </label>
                );
              })}
            </div>
          )}

          {overwriting.length > 0 && (
            <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
              {overwriting.map((key) => CLIP_FIELD_LABELS[key]).join('·')} — 이미 입력된 값을
              덮어씁니다.
            </p>
          )}
        </section>
      </div>
    </Modal>
  );
}
