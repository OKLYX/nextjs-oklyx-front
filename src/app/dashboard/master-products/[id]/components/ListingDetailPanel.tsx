'use client';

import { useMemo, useState, type ReactNode } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { Spinner } from '@/presentation/components/Spinner';
import { TagChipsInput } from '@/presentation/components/TagChipsInput';
import { ListingRegistrationUseCase } from '@/application/usecases/ListingRegistrationUseCase';
import { ListingRegistrationRepositoryImpl } from '@/infrastructure/repositories/ListingRegistrationRepositoryImpl';
import { CopyIdButton } from './CopyIdButton';

const CHANNEL_ONLY_REASON = '마스터 옵션이 없는 채널 전용 옵션입니다';
const OPTION_LINK_UNKNOWN_REASON = '채널별 옵션을 불러오지 못해 연결된 마스터 옵션을 알 수 없습니다';
const OPTION_ID_PENDING_HINT = '승인 후 부여';

/**
 * 마켓에 이미 올라간 옵션은 끌 수 없는 이유(사용자 결정 2026-08-29). 승인된 마켓 옵션은 물리적으로
 * 삭제되지 않아 백엔드(87)가 해제를 400 으로 막는다 → 체크박스를 먼저 잠근다.
 */
export const MARKET_OPTION_LOCK_REASON = '마켓에 등록된 옵션은 뺄 수 없습니다.';

export const formatWon = (v: number) => `${v.toLocaleString('ko-KR')}원`;

/**
 * 판매상품 옵션 한 줄의 화면용 모양. 두 조회를 합친 것이다 —
 * `generated[].optionPrices`(활성·마켓 잠금·가격·재고, 모든 사용자) 와
 * `channel-options`(옵션 ID·연결된 마스터 옵션, ADMIN 전용).
 */
export interface ListingOptionView {
  optionId: number;
  name: string;
  sellingPrice: number;
  /** 2609_19: 자동계산가가 아니라 사람이 정한 값. */
  priceManual: boolean;
  /** 실효 재고 = 채널 값 ?? 마스터 상한(103/D5, 백엔드 SSOT). */
  stock: number;
  /** 채널 값이 없어 마스터 값을 따르는 중 → 회색. */
  stockInherited: boolean;
  active: boolean;
  /** 마켓에 올라가 있고 켜져 있다 → 끌 수 없다(87). */
  lockedOff: boolean;
  platformOptionId: string | null;
  /** null = 채널 전용 옵션, undefined = 채널별 옵션 조회 전/실패(연결을 모른다). */
  masterOptionId: number | null | undefined;
}

interface ListingDetailPanelProps {
  listingId: number;
  name: string;
  // Registration name (등록상품명, 67/68): always auto-computed, read-only.
  registrationName: string;
  tags: string[];
  isAdmin: boolean;
  options: ListingOptionView[];
  /** 옵션 조회가 아직 안 끝났다 — 빈 목록("옵션 없음")과 구분해 스피너를 보여준다. */
  optionsLoading: boolean;
  /** 이 셀의 활성 옵션 저장 중(43) → 체크박스 잠금. */
  optionBusy: boolean;
  onToggleOption: (optionId: number) => void;
  /** 옵션 행 [수정] — 지금은 「상품 기본 정보 > 옵션」의 그 옵션으로 보낸다(추후 옵션 상세 페이지). */
  onEditMasterOption: (masterOptionId: number) => void;
  onSaved: () => void;
  /** 한 번 더 접는 「태그 · 이미지 · 상세페이지」 안에 들어갈 썸네일·상세 미리보기(부모가 그린다). */
  thumbnail: ReactNode;
  detailThumb: ReactNode;
}

/**
 * 판매상품 행을 펼쳤을 때의 본문 = 이름 · 옵션 표 · (한 번 더 접힌) 태그·이미지·상세페이지.
 * File: src/app/dashboard/master-products/[id]/components/ListingDetailPanel.tsx
 *
 * - 노출상품명: [수정] 으로 조회↔편집(빈값 저장 불가). 로컬 저장뿐 — 마켓 반영은 [수정 요청].
 * - 등록상품명(67/68): 채널 활성옵션 기준 자동값 → 읽기 전용.
 * - 옵션 표: 옵션명 / 가격 / 재고 / 옵션 ID / [수정]. 🔴 **옵션·가격·재고를 보여주는 곳은 여기 한 곳**이다
 *   (예전 매트릭스 「판매가」 열은 없앴다). 체크박스 = 이 채널에서 마켓에 보낼지(43), 미사용 옵션은 흐리게.
 *   마켓에 올라간 옵션은 끌 수 없다(🔒, 87). [수정]은 옵션을 편집하지 않고 편집 지점으로 보낸다(2609_61/D7).
 * - 태그: 채널 raw 태그(33). 현재값은 매트릭스가 이미 받은 `generated[].tags`(추가 호출 없음).
 *
 * 저장은 모두 상위 재조회(onSaved)로 갱신한다.
 */
export function ListingDetailPanel({
  listingId,
  name,
  registrationName,
  tags,
  isAdmin,
  options,
  optionsLoading,
  optionBusy,
  onToggleOption,
  onEditMasterOption,
  onSaved,
  thumbnail,
  detailThumb,
}: ListingDetailPanelProps) {
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

  const [extrasOpen, setExtrasOpen] = useState(false);

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
    <div className="space-y-3 border-t border-gray-100 bg-gray-50/70 py-3 pl-12 pr-4">
      {/* 노출상품명 */}
      <div className="flex flex-wrap items-center gap-2 text-sm text-gray-700">
        <span className="w-16 shrink-0 text-xs font-semibold text-gray-500">노출상품명</span>
        {isEditingName ? (
          <>
            <input
              type="text"
              value={nameDraft}
              onChange={(e) => setNameDraft(e.target.value)}
              disabled={savingName}
              className="min-w-0 flex-1 rounded border border-gray-300 px-2 py-1 text-sm"
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
            <span className="min-w-0 break-words font-medium text-gray-900">{name}</span>
            {isAdmin && (
              <button
                type="button"
                onClick={startEditName}
                className="rounded border border-gray-300 px-2 py-0.5 text-xs font-medium text-gray-700 hover:bg-gray-100"
              >
                수정
              </button>
            )}
          </>
        )}
        {nameError && <span className="text-xs text-red-600">{nameError}</span>}
      </div>

      {/* 등록상품명 (67/68): 읽기 전용 — 채널 활성옵션 기준 자동값 */}
      <div className="flex flex-wrap items-center gap-2 text-sm text-gray-700">
        <span className="w-16 shrink-0 text-xs font-semibold text-gray-500">등록상품명</span>
        <span className="min-w-0 break-words text-gray-900">{registrationName}</span>
      </div>

      {/* 옵션 표 — 옵션·가격·재고를 보여주는 유일한 자리. */}
      <div className="rounded border border-gray-200 bg-white">
        {optionsLoading && options.length === 0 ? (
          <div className="px-3 py-2">
            <Spinner size={12} label="옵션 불러오는 중" />
          </div>
        ) : options.length === 0 ? (
          <p className="px-3 py-2 text-xs text-gray-400">옵션 없음</p>
        ) : (
          <table className="w-full table-fixed text-xs">
            <thead className="border-b border-gray-200 bg-gray-100 text-left text-gray-600">
              <tr>
                {isAdmin && <th className="w-8 px-2 py-1.5" aria-label="사용" />}
                <th className="px-2 py-1.5 font-medium">옵션명</th>
                <th className="w-28 px-2 py-1.5 text-right font-medium">가격</th>
                <th className="w-16 px-2 py-1.5 text-right font-medium">재고</th>
                <th className="w-40 px-2 py-1.5 font-medium">옵션 ID</th>
                {isAdmin && <th className="w-14 px-2 py-1.5" aria-label="수정" />}
              </tr>
            </thead>
            <tbody>
              {options.map((o) => {
                const dim = o.active ? '' : 'text-gray-400';
                return (
                  <tr key={o.optionId} className="border-t border-gray-100">
                    {isAdmin && (
                      <td className="px-2 py-1.5">
                        {/* 툴팁은 label 에 — disabled input 은 hover 이벤트를 쏘지 않는다. */}
                        <label
                          className="flex items-center gap-0.5"
                          title={
                            o.lockedOff
                              ? `${MARKET_OPTION_LOCK_REASON} 판매를 멈추려면 쿠팡 WING 에서 처리하세요.`
                              : o.active
                                ? '마켓에 보내는 옵션'
                                : '이 채널에서 쓰지 않는 옵션'
                          }
                        >
                          <input
                            type="checkbox"
                            checked={o.active}
                            disabled={optionBusy || o.lockedOff}
                            onChange={() => onToggleOption(o.optionId)}
                          />
                          {o.lockedOff && <span className="text-[10px] text-gray-400">🔒</span>}
                        </label>
                      </td>
                    )}
                    <td className={`truncate px-2 py-1.5 ${o.active ? 'text-gray-900' : dim}`} title={o.name}>
                      {o.name}
                      {!o.active && <span className="ml-1 text-[10px]">(미사용)</span>}
                    </td>
                    <td className={`px-2 py-1.5 text-right tabular-nums ${dim}`}>
                      {formatWon(o.sellingPrice)}
                      {/* 2609_19: 사람이 정한 값 표식. 재고의 '상속=회색' 과는 다른 규칙이다. */}
                      {o.priceManual && (
                        <span className="ml-1 rounded bg-amber-100 px-1 text-[10px] text-amber-700">
                          수동
                        </span>
                      )}
                    </td>
                    <td
                      className={`px-2 py-1.5 text-right tabular-nums ${
                        o.active && !o.stockInherited ? '' : 'text-gray-400'
                      }`}
                    >
                      {o.stock}
                    </td>
                    <td className="px-2 py-1.5">
                      {/* 2609_61/D2: 옵션 ID 는 승인 후에 생긴다 — 없다고 경고색으로 그리지 않는다. */}
                      {o.platformOptionId ? (
                        <span className="flex min-w-0 items-center gap-1">
                          <span className={`truncate font-mono tabular-nums ${o.active ? 'text-gray-600' : dim}`}>
                            {o.platformOptionId}
                          </span>
                          <CopyIdButton value={o.platformOptionId} />
                        </span>
                      ) : (
                        <span className="text-gray-400" title={OPTION_ID_PENDING_HINT}>
                          –
                        </span>
                      )}
                    </td>
                    {isAdmin && (
                      <td className="px-2 py-1.5 text-right">
                        <button
                          type="button"
                          onClick={
                            o.masterOptionId == null
                              ? undefined
                              : () => onEditMasterOption(o.masterOptionId as number)
                          }
                          disabled={o.masterOptionId == null}
                          title={
                            o.masterOptionId === null
                              ? CHANNEL_ONLY_REASON
                              : o.masterOptionId === undefined
                                ? OPTION_LINK_UNKNOWN_REASON
                                : undefined
                          }
                          className="rounded border border-gray-300 px-1.5 py-0.5 text-[11px] font-medium text-gray-700 hover:bg-gray-100 disabled:text-gray-400 disabled:hover:bg-transparent"
                        >
                          수정
                        </button>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* 태그·이미지·상세페이지 = 한 번 더 접는다(자주 보지 않는 값). */}
      <div>
        <button
          type="button"
          onClick={() => setExtrasOpen((v) => !v)}
          aria-expanded={extrasOpen}
          className="flex items-center gap-1 text-xs font-medium text-gray-600 hover:text-gray-900"
        >
          {extrasOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          태그 {tags.length}개 · 이미지 · 상세페이지
        </button>
        {extrasOpen && (
          <div className="mt-2 space-y-3 pl-5">
            <div className="flex flex-wrap items-start gap-2 text-sm text-gray-700">
              <span className="w-16 shrink-0 pt-0.5 text-xs font-semibold text-gray-500">태그</span>
              {isEditingTags ? (
                <>
                  <div className="min-w-0 flex-1">
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
                  <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1">
                    {tags.length > 0 ? (
                      tags.map((tag, i) => (
                        <span
                          key={`${tag}-${i}`}
                          className="rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-800"
                        >
                          {tag}
                        </span>
                      ))
                    ) : (
                      <span className="text-xs text-gray-400">없음</span>
                    )}
                  </div>
                  {isAdmin && (
                    <button
                      type="button"
                      onClick={startEditTags}
                      className="rounded border border-gray-300 px-2 py-0.5 text-xs font-medium text-gray-700 hover:bg-gray-100"
                    >
                      수정
                    </button>
                  )}
                </>
              )}
              {tagsError && <span className="text-xs text-red-600">{tagsError}</span>}
            </div>
            <div className="flex flex-wrap items-start gap-2">
              <span className="w-16 shrink-0 text-xs font-semibold text-gray-500">이미지</span>
              {thumbnail}
            </div>
            <div className="flex flex-wrap items-start gap-2">
              <span className="w-16 shrink-0 text-xs font-semibold text-gray-500">상세페이지</span>
              {detailThumb}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
