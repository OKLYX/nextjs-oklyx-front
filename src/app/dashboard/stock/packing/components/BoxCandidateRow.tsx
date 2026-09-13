'use client';

import { BoxShape } from '@/presentation/components/BoxShape';
import { StateBlock } from '@/presentation/components/ui/StateBlock';
import { BOX_KIND_LABEL, boxKindOf } from '@/domain/entities/PackageEntity';
import type { BoxCandidate } from '@/domain/entities/PackingEntity';

/**
 * 담은 조합으로 추천된 상자 후보 (FEATURE_2609_40 / PLAN D23 · D26 · D33).
 *
 * 🔴 선택 단축키는 **F1 · F2 · F3** 이다. 숫자키를 쓰면 「숫자 + Enter = 수량 수정」과 겹친다(D33).
 * 🔴 사진이 없는 상자는 공용 `BoxShape` 를 쓴다(D26) — 상자 관리 목록과 같은 그림이어야
 * 같은 상자로 보인다.
 */
export interface BoxCandidateRowProps {
  candidates: BoxCandidate[];
  selectedPackageId: number | null;
  loading: boolean;
  onSelect: (packageId: number) => void;
}

/** 후보는 최대 3개다 — 단축키도 3개뿐이다 */
const HOTKEYS = ['F1', 'F2', 'F3'];

export function BoxCandidateRow({
  candidates,
  selectedPackageId,
  loading,
  onSelect,
}: BoxCandidateRowProps) {
  if (loading) {
    return (
      <div className="flex gap-3">
        {[0, 1, 2].map((index) => (
          <div key={index} className="h-28 w-56 animate-pulse rounded-lg bg-gray-100" />
        ))}
      </div>
    );
  }

  if (candidates.length === 0) {
    return <StateBlock variant="empty" message="적합한 상자를 찾지 못했습니다" />;
  }

  return (
    <div className="flex flex-wrap gap-3">
      {candidates.map((candidate, index) => {
        const selected = candidate.packageId === selectedPackageId;
        return (
          <button
            key={candidate.packageId}
            type="button"
            onClick={(event) => {
              // 포커스를 버튼에 남기면 다음 Enter 가 [이 박스 완료] 대신 이 버튼을 다시 누른다.
              event.currentTarget.blur();
              onSelect(candidate.packageId);
            }}
            className={`flex w-56 items-center gap-3 rounded-lg border-2 p-3 text-left ${
              selected ? 'border-blue-600 bg-blue-50' : 'border-gray-200 bg-white hover:border-gray-300'
            }`}
          >
            <div className="flex h-14 w-14 shrink-0 items-center justify-center">
              {candidate.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={candidate.imageUrl}
                  alt={`${candidate.type} 상자 사진`}
                  className="h-14 w-14 rounded border border-gray-200 object-contain"
                />
              ) : (
                <BoxShape
                  widthCm={candidate.widthCm}
                  lengthCm={candidate.lengthCm}
                  heightCm={candidate.heightCm}
                  size={56}
                />
              )}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                {HOTKEYS[index] && (
                  <kbd className="rounded border border-gray-300 bg-gray-50 px-1.5 py-0.5 text-xs font-semibold text-gray-600">
                    {HOTKEYS[index]}
                  </kbd>
                )}
                <span className="truncate font-medium text-gray-900">{candidate.type}</span>
              </div>
              <div className="mt-0.5 text-xs text-gray-500">
                {candidate.widthCm} × {candidate.lengthCm} × {candidate.heightCm} cm
              </div>
              <div className="mt-0.5 text-xs text-gray-500">
                {BOX_KIND_LABEL[boxKindOf(candidate)]} · {candidate.useCount}회
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}
