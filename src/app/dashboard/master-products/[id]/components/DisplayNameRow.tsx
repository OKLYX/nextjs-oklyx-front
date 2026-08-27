'use client';

import { useMemo, useState } from 'react';
import { Spinner } from '@/presentation/components/Spinner';
import { TagChipsInput } from '@/presentation/components/TagChipsInput';
import { ListingRegistrationUseCase } from '@/application/usecases/ListingRegistrationUseCase';
import { ListingRegistrationRepositoryImpl } from '@/infrastructure/repositories/ListingRegistrationRepositoryImpl';

interface DisplayNameRowProps {
  listingId: number;
  name: string;
  // Registration name (등록상품명, 67/68): always auto-computed, read-only. Always present.
  registrationName: string;
  tags: string[];
  onSaved: () => void;
}

/**
 * 채널(리스팅) 인라인 편집 sub-row: 노출상품명(=ProductListing.name) + 채널 raw 태그.
 * File: src/app/dashboard/master-products/[id]/components/DisplayNameRow.tsx
 *
 * 커버리지 매트릭스의 등록된 채널 <tr> 바로 아래에 tbody 직속 <tr> 로 렌더된다
 * (CoverageMatrix 가 Fragment 로 채널 row + 이 row 를 함께 배치). 미등록 채널은 없음.
 * 체크박스 컬럼만큼 들여쓰기 위해 첫 <td> 는 비우고 나머지 8칸에 내용을 둔다.
 *
 * - 노출상품명: name 은 NOT NULL 이라 실질은 조회 + 수정(빈값 저장 불가).
 * - 등록상품명(67/68): 언제나 채널 활성옵션 기준 자동값 → 읽기 전용 표시(수정/배지 없음).
 *   옵션 활성 토글(43) 시 CoverageMatrix 가 그 셀 값만 갱신한다.
 * - 태그: 채널 raw 태그(prompt 33). 현재값은 CoverageMatrix 가 이미 fetch 한
 *   generated[listingId].tags 를 prop 으로 받아 재사용(추가 호출 없음). 빈 리스트 저장(=태그 제거) 허용.
 *
 * 저장은 모두 상위 load 재조회(onSaved)로 갱신한다. 마스터 풀과의 태그 결합은 백엔드
 * push 시점 처리(아웃 오브 스코프).
 */
export function DisplayNameRow({
  listingId,
  name,
  registrationName,
  tags,
  onSaved,
}: DisplayNameRowProps) {
  const listingUseCase = useMemo(
    () => new ListingRegistrationUseCase(new ListingRegistrationRepositoryImpl()),
    [],
  );

  // Display name (노출상품명)
  const [isEditingName, setIsEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState(name);
  const [savingName, setSavingName] = useState(false);
  const [nameError, setNameError] = useState('');

  // Channel raw tags
  const [isEditingTags, setIsEditingTags] = useState(false);
  const [tagsDraft, setTagsDraft] = useState<string[]>(tags);
  const [savingTags, setSavingTags] = useState(false);
  const [tagsError, setTagsError] = useState('');

  const trimmedName = nameDraft.trim();

  const startEditName = () => {
    setNameDraft(name);
    setNameError('');
    setIsEditingName(true);
  };

  const saveName = async () => {
    if (!trimmedName) return;
    setSavingName(true);
    setNameError('');
    try {
      await listingUseCase.updateDisplayName(listingId, { name: trimmedName });
      setIsEditingName(false);
      onSaved();
    } catch {
      setNameError('노출상품명 저장에 실패했습니다.');
    } finally {
      setSavingName(false);
    }
  };

  const startEditTags = () => {
    setTagsDraft(tags);
    setTagsError('');
    setIsEditingTags(true);
  };

  const saveTags = async () => {
    setSavingTags(true);
    setTagsError('');
    try {
      await listingUseCase.updateTags(listingId, { tags: tagsDraft });
      setIsEditingTags(false);
      onSaved();
    } catch {
      setTagsError('태그 저장에 실패했습니다.');
    } finally {
      setSavingTags(false);
    }
  };

  return (
    <tr className="border-b-2 border-blue-100 bg-blue-50/60">
      <td className="px-4 py-2" aria-hidden />
      <td colSpan={8} className="border-l-4 border-blue-400 px-4 py-2.5">
        <div className="space-y-2">
          {/* 노출상품명 */}
          <div className="flex flex-wrap items-center gap-2 text-sm text-gray-700">
            <span className="shrink-0 rounded bg-blue-100 px-2 py-0.5 text-xs font-semibold text-blue-700">
              노출상품명
            </span>
            {isEditingName ? (
              <>
                <input
                  type="text"
                  value={nameDraft}
                  onChange={(e) => setNameDraft(e.target.value)}
                  disabled={savingName}
                  className="min-w-64 flex-1 rounded border border-gray-300 px-2 py-1 text-sm"
                />
                <button
                  type="button"
                  onClick={saveName}
                  disabled={savingName || !trimmedName}
                  className="flex items-center gap-1 rounded border border-blue-300 px-2 py-1 text-xs font-medium text-blue-700 hover:bg-blue-50 disabled:opacity-50"
                >
                  {savingName ? <Spinner size={12} label="저장 중" /> : '저장'}
                </button>
                <button
                  type="button"
                  onClick={() => setIsEditingName(false)}
                  disabled={savingName}
                  className="rounded border border-gray-300 px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-100 disabled:opacity-50"
                >
                  취소
                </button>
              </>
            ) : (
              <>
                <span className="font-semibold text-gray-900">{name}</span>
                <button
                  type="button"
                  onClick={startEditName}
                  className="rounded border border-gray-300 px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-100"
                >
                  수정
                </button>
              </>
            )}
            {nameError && <span className="text-xs text-red-600">{nameError}</span>}
          </div>

          {/* 등록상품명 (67/68): 읽기 전용 — 채널 활성옵션 기준 자동값 */}
          <div className="flex flex-wrap items-center gap-2 text-sm text-gray-700">
            <span className="shrink-0 rounded bg-blue-100 px-2 py-0.5 text-xs font-semibold text-blue-700">
              등록상품명
            </span>
            <span className="font-semibold text-gray-900">{registrationName}</span>
          </div>

          {/* 채널 태그 */}
          <div className="flex flex-wrap items-start gap-2 text-sm text-gray-700">
            <span className="shrink-0 rounded bg-gray-200 px-2 py-0.5 text-xs font-semibold text-gray-600">
              태그
            </span>
            {isEditingTags ? (
              <>
                <div className="min-w-64 flex-1">
                  <TagChipsInput tags={tagsDraft} onChange={setTagsDraft} disabled={savingTags} />
                </div>
                <button
                  type="button"
                  onClick={saveTags}
                  disabled={savingTags}
                  className="flex items-center gap-1 rounded border border-blue-300 px-2 py-1 text-xs font-medium text-blue-700 hover:bg-blue-50 disabled:opacity-50"
                >
                  {savingTags ? <Spinner size={12} label="저장 중" /> : '저장'}
                </button>
                <button
                  type="button"
                  onClick={() => setIsEditingTags(false)}
                  disabled={savingTags}
                  className="rounded border border-gray-300 px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-100 disabled:opacity-50"
                >
                  취소
                </button>
              </>
            ) : (
              <>
                <div className="flex flex-1 flex-wrap items-center gap-1">
                  {tags.length > 0 ? (
                    tags.map((tag, i) => (
                      <span
                        key={`${tag}-${i}`}
                        className="rounded bg-gray-100 px-2 py-0.5 text-sm text-gray-800"
                      >
                        {tag}
                      </span>
                    ))
                  ) : (
                    <span className="text-gray-400">없음</span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={startEditTags}
                  className="rounded border border-gray-300 px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-100"
                >
                  수정
                </button>
              </>
            )}
            {tagsError && <span className="text-xs text-red-600">{tagsError}</span>}
          </div>
        </div>
      </td>
    </tr>
  );
}
