'use client';

import { useMemo, useState } from 'react';
import { Spinner } from '@/presentation/components/Spinner';
import { TagChipsInput } from '@/presentation/components/TagChipsInput';
import { ListingRegistrationUseCase } from '@/application/usecases/ListingRegistrationUseCase';
import { ListingRegistrationRepositoryImpl } from '@/infrastructure/repositories/ListingRegistrationRepositoryImpl';
import type { ListingOptionSummary } from '@/domain/entities/ListingRegistrationEntity';
import { CopyIdButton } from './CopyIdButton';

const CHANNEL_ONLY_REASON = '마스터 옵션이 없는 채널 전용 옵션입니다';
const OPTION_ID_PENDING_HINT = '승인 후 부여';

// 매트릭스 판매가 열·「채널별 옵션」 표와 같은 표기(`12,900원`).
const formatWon = (v: number) => `${v.toLocaleString('ko-KR')}원`;

interface DisplayNameRowProps {
  listingId: number;
  /**
   * 이 서브행이 어느 셀의 것인지 알려주는 꼬리표(그 셀의 상품 ID, 미전송이면 `미전송`).
   * 한 계정이 쿠팡 상품페이지를 여러 개 가지면 서브행도 그만큼 연달아 서므로, 꼬리표가 없으면
   * 어느 페이지의 노출상품명·태그를 고치는지 알 수 없다. 셀이 하나뿐이면 `null` = 표시 안 함
   * (기존 화면 그대로).
   */
  cellTag?: string | null;
  name: string;
  // Registration name (등록상품명, 67/68): always auto-computed, read-only. Always present.
  registrationName: string;
  tags: string[];
  /**
   * 2609_61: 이 셀의 채널 옵션(활성·비활성 전부). 조회는 `CoverageMatrix` 가 마스터 단위로 한 번
   * 한다 — 이 컴포넌트는 채널 수만큼 렌더되므로 여기서 조회하면 화면 하나에 HTTP N 번이다(D6).
   */
  options: ListingOptionSummary[];
  /** 위 집계가 아직 안 온 상태. 빈 목록("옵션 없음")과 구분해 스피너를 보여준다. */
  optionsLoading: boolean;
  /** [옵션 수정] — 「상품 기본 정보 > 옵션」의 그 옵션으로 보낸다(「채널별 옵션」 표와 같은 동작). */
  onEditMasterOption: (masterOptionId: number) => void;
  onSaved: () => void;
}

/**
 * 채널(리스팅) 인라인 편집 sub-row: 노출상품명(=ProductListing.name) + 채널 raw 태그.
 * File: src/app/dashboard/master-products/[id]/components/DisplayNameRow.tsx
 *
 * 커버리지 매트릭스의 등록된 채널 <tr> 바로 아래에 tbody 직속 <tr> 로 렌더된다
 * (CoverageMatrix 가 Fragment 로 채널 row + 이 row 를 함께 배치). 미등록 채널은 없음.
 * 체크박스 컬럼만큼 들여쓰기 위해 첫 <td> 는 비우고 나머지 9칸에 내용을 둔다.
 *
 * - 노출상품명: name 은 NOT NULL 이라 실질은 조회 + 수정(빈값 저장 불가).
 * - 등록상품명(67/68): 언제나 채널 활성옵션 기준 자동값 → 읽기 전용 표시(수정/배지 없음).
 *   옵션 활성 토글(43) 시 CoverageMatrix 가 그 셀 값만 갱신한다.
 * - 태그: 채널 raw 태그(prompt 33). 현재값은 CoverageMatrix 가 이미 fetch 한
 *   generated[listingId].tags 를 prop 으로 받아 재사용(추가 호출 없음). 빈 리스트 저장(=태그 제거) 허용.
 * - 옵션(2609_61): 이 셀의 옵션을 옵션 ID·판매가·재고와 함께 나열하고, 옵션마다 [옵션 수정] 으로
 *   「상품 기본 정보 > 옵션」의 그 옵션으로 보낸다. 🔴 **여기서 옵션을 편집하지 않는다**(D7) —
 *   옵션을 고치는 곳은 그 한 곳이고, 채널 값(가격·재고·활성)은 매트릭스 행의 기존 모달이 담당한다.
 *
 * 저장은 모두 상위 load 재조회(onSaved)로 갱신한다. 마스터 풀과의 태그 결합은 백엔드
 * push 시점 처리(아웃 오브 스코프).
 */
export function DisplayNameRow({
  listingId,
  cellTag = null,
  name,
  registrationName,
  tags,
  options,
  optionsLoading,
  onEditMasterOption,
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
      <td colSpan={9} className="border-l-4 border-blue-400 px-4 py-2.5">
        <div className="space-y-2">
          {/* 노출상품명 */}
          <div className="flex flex-wrap items-center gap-2 text-sm text-gray-700">
            {/* 셀이 여럿일 때만 붙는 꼬리표 — 매트릭스 본문 각 열의 꼬리표와 같은 값이다. */}
            {cellTag && (
              <span className="shrink-0 font-mono text-[10px] tabular-nums text-gray-500">
                {cellTag}
              </span>
            )}
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
            {/* 109: saving is local only — the market copy changes on [수정 요청]. */}
            <span className="text-[11px] text-gray-500">마켓 반영은 [수정 요청]</span>
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

          {/* 옵션 (2609_61): 이 셀의 옵션 + 옵션 ID + [옵션 수정]. */}
          <div className="flex flex-wrap items-start gap-2 text-sm text-gray-700">
            <span className="shrink-0 rounded bg-gray-200 px-2 py-0.5 text-xs font-semibold text-gray-600">
              옵션
            </span>
            <div className="flex-1 space-y-1">
              {optionsLoading ? (
                <Spinner size={12} label="불러오는 중" />
              ) : options.length === 0 ? (
                <span className="text-gray-400">없음</span>
              ) : (
                options.map((option) => {
                  const active = option.active !== false;
                  // 2609_22/D2: 마스터에 대응 옵션이 없으면 보낼 곳이 없다 → 버튼 비활성 + 사유.
                  const masterOptionId = option.masterOptionId ?? null;
                  return (
                    <div
                      key={option.optionId}
                      className="flex flex-wrap items-center gap-2 text-sm"
                    >
                      <span className={active ? 'font-medium text-gray-900' : 'text-gray-400'}>
                        {option.optionName}
                      </span>
                      <span className={active ? 'text-gray-600' : 'text-gray-400'}>
                        {active
                          ? `${formatWon(option.sellingPrice)} / ${option.stockQuantity ?? option.maxStock}`
                          : '미사용'}
                      </span>
                      {/* 2609_61/D2: 옵션 ID 는 승인 후에 생긴다 — 없다고 경고색으로 그리지 않는다. */}
                      {option.platformOptionId ? (
                        <span className="flex items-center gap-1">
                          <span className="font-mono text-xs tabular-nums text-gray-600">
                            옵션ID {option.platformOptionId}
                          </span>
                          <CopyIdButton value={option.platformOptionId} />
                        </span>
                      ) : (
                        <span className="text-xs text-gray-400" title={OPTION_ID_PENDING_HINT}>
                          옵션ID –
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={
                          masterOptionId == null
                            ? undefined
                            : () => onEditMasterOption(masterOptionId)
                        }
                        disabled={masterOptionId == null}
                        title={masterOptionId == null ? CHANNEL_ONLY_REASON : undefined}
                        className="rounded border border-blue-300 px-2 py-0.5 text-xs font-medium text-blue-600 hover:bg-blue-50 disabled:border-gray-300 disabled:text-gray-400 disabled:hover:bg-transparent"
                      >
                        옵션 수정
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </td>
    </tr>
  );
}
