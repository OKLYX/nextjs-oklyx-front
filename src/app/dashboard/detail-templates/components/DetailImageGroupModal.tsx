'use client';

import { useCallback, useEffect, useState } from 'react';
import axios from 'axios';
import { Spinner } from '@/presentation/components/Spinner';
import type { DetailImageGroupUseCase } from '@/application/usecases/DetailImageGroupUseCase';
import type { DetailImageGroup } from '@/domain/entities/DetailImageGroupEntity';

/**
 * 상세 이미지 그룹 관리 팝업 — 템플릿 이미지 블록이 고를 수 있는 공용 존 카탈로그의 CRUD.
 * File: src/app/dashboard/detail-templates/components/DetailImageGroupModal.tsx
 *
 * hand-rolled `fixed inset-0`(프로젝트에 shadcn Dialog 미도입 → MasterPoolManageModal 스타일 미러).
 *
 * **필수 규칙**:
 *   - `code` 는 화면 어디에도 표시하지 않는다. 사용자에게 존재하는 값은 이름뿐.
 *   - 삭제 차단 조건은 `templateCount > 0` 뿐이다. `imageCount` 로 막지 말 것 —
 *     막으면 실제로 쓰인 그룹은 영원히 삭제 불가가 된다(지워지는 건 그룹↔사진 연결뿐, 사진은 남는다).
 *   - 400(이름 중복 / 사용 중) 메시지는 서버 문구를 그대로 노출한다(자체 문구 창작 금지).
 *   - 액션별 busy 로 해당 버튼만 비활성 — 전체 잠금 금지.
 *
 * @example
 * {groupModalOpen && (
 *   <DetailImageGroupModal useCase={groupUseCase} onClose={() => setGroupModalOpen(false)} />
 * )}
 */
interface DetailImageGroupModalProps {
  useCase: DetailImageGroupUseCase;
  onClose: () => void;
  /** 목록이 바뀌었을 때(추가/이름변경/삭제) 부모가 그룹을 다시 읽게 한다. */
  onChanged?: () => void;
}

const messageOf = (e: unknown): string =>
  axios.isAxiosError(e) ? (e.response?.data?.message ?? '요청에 실패했습니다') : '요청에 실패했습니다';

export function DetailImageGroupModal({ useCase, onClose, onChanged }: DetailImageGroupModalProps) {
  const [groups, setGroups] = useState<DetailImageGroup[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  const [newName, setNewName] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  // Inline rename: id of the row in edit mode + its draft name.
  const [renamingId, setRenamingId] = useState<number | null>(null);
  const [renameDraft, setRenameDraft] = useState('');
  // Per-action busy so only the acting row's button is disabled.
  const [busyId, setBusyId] = useState<number | null>(null);

  // Initial load (DetailTemplateList 패턴). 액션 후 갱신은 아래 `refresh` — 스피너는 최초 1회만이고
  // 액션 중에는 해당 버튼의 busy 표시로 충분하다(목록 전체가 사라졌다 나타나지 않게).
  useEffect(() => {
    let alive = true;
    (async () => {
      setIsLoading(true);
      try {
        const list = await useCase.list();
        if (!alive) return;
        setGroups(list);
        setError('');
      } catch (e) {
        if (alive) setError(messageOf(e));
      } finally {
        if (alive) setIsLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [useCase]);

  const refresh = useCallback(async () => {
    setGroups(await useCase.list());
  }, [useCase]);

  const handleCreate = async () => {
    const name = newName.trim();
    if (!name) return;
    setIsCreating(true);
    setError('');
    try {
      await useCase.create(name);
      setNewName('');
      await refresh();
      onChanged?.();
    } catch (e) {
      setError(messageOf(e));
    } finally {
      setIsCreating(false);
    }
  };

  const handleRename = async (id: number) => {
    const name = renameDraft.trim();
    if (!name) return;
    setBusyId(id);
    setError('');
    try {
      await useCase.rename(id, name);
      setRenamingId(null);
      await refresh();
      onChanged?.();
    } catch (e) {
      setError(messageOf(e));
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = async (group: DetailImageGroup) => {
    // imageCount is a warning, never a blocker: only the mapping is dropped, the photos stay.
    if (
      group.imageCount > 0 &&
      !window.confirm(
        `"${group.name}" 그룹을 삭제합니다. 사진 ${group.imageCount}장의 연결이 해제됩니다(사진 자체는 지워지지 않습니다).`,
      )
    )
      return;
    setBusyId(group.id);
    setError('');
    try {
      await useCase.remove(group.id);
      await refresh();
      onChanged?.();
    } catch (e) {
      setError(messageOf(e));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4">
      <div className="flex max-h-[85vh] w-full max-w-2xl flex-col rounded-lg bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-gray-200 px-5 py-3">
          <h3 className="text-base font-semibold text-gray-900">이미지 그룹 관리</h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded px-2 py-1 text-sm text-gray-500 hover:bg-gray-100"
          >
            닫기
          </button>
        </div>

        <div className="min-h-40 flex-1 space-y-3 overflow-y-auto p-5">
          {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

          <div className="flex gap-2">
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="새 그룹 이름 (예: 제품 사진)"
              className="w-full rounded border border-gray-300 px-2 py-1 text-sm text-gray-900 focus:border-blue-500 focus:outline-none"
            />
            <button
              type="button"
              onClick={handleCreate}
              disabled={!newName.trim() || isCreating}
              className="shrink-0 rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {isCreating ? '추가 중...' : '추가'}
            </button>
          </div>

          {isLoading ? (
            <div className="flex min-h-32 items-center justify-center">
              <Spinner size={24} label="불러오는 중..." />
            </div>
          ) : groups.length === 0 ? (
            <p className="rounded-lg border border-dashed border-gray-300 py-8 text-center text-sm text-gray-500">
              등록된 이미지 그룹이 없습니다. 위에서 추가하세요.
            </p>
          ) : (
            <ul className="divide-y divide-gray-200 rounded-lg border border-gray-200">
              {groups.map((g) => {
                const inUse = g.templateCount > 0;
                const busy = busyId === g.id;
                return (
                  <li key={g.id} className="flex flex-wrap items-center gap-2 px-3 py-2">
                    {renamingId === g.id ? (
                      <>
                        <input
                          type="text"
                          value={renameDraft}
                          onChange={(e) => setRenameDraft(e.target.value)}
                          className="min-w-0 flex-1 rounded border border-gray-300 px-2 py-1 text-sm text-gray-900 focus:border-blue-500 focus:outline-none"
                        />
                        <button
                          type="button"
                          onClick={() => handleRename(g.id)}
                          disabled={!renameDraft.trim() || busy}
                          className="rounded border border-blue-600 px-2 py-1 text-xs font-medium text-blue-600 hover:bg-blue-50 disabled:opacity-50"
                        >
                          {busy ? '저장 중...' : '저장'}
                        </button>
                        <button
                          type="button"
                          onClick={() => setRenamingId(null)}
                          className="rounded border border-gray-300 px-2 py-1 text-xs font-medium text-gray-600 hover:bg-gray-100"
                        >
                          취소
                        </button>
                      </>
                    ) : (
                      <>
                        <span className="min-w-0 flex-1 truncate text-sm text-gray-900">{g.name}</span>
                        <span className="shrink-0 text-xs text-gray-500">
                          사용 템플릿 {g.templateCount} · 사진 {g.imageCount}
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            setRenamingId(g.id);
                            setRenameDraft(g.name);
                          }}
                          className="rounded border border-gray-300 px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-100"
                        >
                          이름변경
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(g)}
                          disabled={inUse || busy}
                          className="rounded border border-red-300 px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
                        >
                          {busy ? '삭제 중...' : '삭제'}
                        </button>
                        {inUse && (
                          <span className="w-full text-[11px] text-gray-400">
                            {g.usedByTemplateNames.join(' · ')} 에서 사용 중
                          </span>
                        )}
                      </>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="flex justify-end border-t border-gray-200 px-5 py-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-100"
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  );
}
