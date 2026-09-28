'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { PageContainer } from '@/presentation/components/PageContainer';
import { Card } from '@/presentation/components/ui/Card';
import { Button } from '@/presentation/components/ui/Button';
import { Input } from '@/presentation/components/ui/Input';
import { StateBlock } from '@/presentation/components/ui/StateBlock';
import { ConfirmDialog } from '@/presentation/components/ui/ConfirmDialog';
import { PurchasePlaceUseCase } from '@/application/usecases/PurchasePlaceUseCase';
import { PurchasePlaceRepositoryImpl } from '@/infrastructure/repositories/PurchasePlaceRepositoryImpl';
import type { PurchasePlace } from '@/domain/entities/PurchasePlace';
import { extractErrorMessage } from '@/infrastructure/utils/errorMessage';

/**
 * 설정 > 구매처 관리 (FEATURE_2609_76 / D2 · D9 · D14 · D15).
 * File: src/app/dashboard/settings/purchase-places/components/PurchasePlaceContainer.tsx
 *
 * - 추가 · 이름 변경 · 삭제. 관리자만 쓴다(메뉴가 관리자 전용이고, 서버가 쓰기를 403 으로 막는다).
 * - 이름을 바꾸면 그 구매처를 쓰는 모든 물품에 바뀐 이름이 보인다 — 물품은 id 를 가진다(D3).
 * - 삭제는 쓰는 물품이 0개일 때만(D9). 쓰는 중이면 버튼을 막고 「N개 물품이 사용 중」 을 보인다.
 * - 서버 400 문구(이름 중복 · 사용 중)는 그대로 보인다 — 자체 문구를 만들지 않는다.
 * - 액션별 busy 로 그 줄의 버튼만 막는다.
 */
export function PurchasePlaceContainer() {
  const useCase = useMemo(() => new PurchasePlaceUseCase(new PurchasePlaceRepositoryImpl()), []);
  const [places, setPlaces] = useState<PurchasePlace[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [newName, setNewName] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [renamingId, setRenamingId] = useState<number | null>(null);
  const [renameDraft, setRenameDraft] = useState('');
  const [busyId, setBusyId] = useState<number | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<PurchasePlace | null>(null);

  // 최초 1회만 스피너. 액션 뒤 갱신은 `refresh` — 목록이 사라졌다 나타나지 않게.
  useEffect(() => {
    let alive = true;
    useCase.list().then(
      (list) => {
        if (!alive) return;
        setPlaces(list);
        setIsLoading(false);
      },
      (e: unknown) => {
        if (!alive) return;
        setError(extractErrorMessage(e, '구매처 목록을 불러오지 못했습니다.'));
        setIsLoading(false);
      },
    );
    return () => {
      alive = false;
    };
  }, [useCase]);

  const refresh = useCallback(async () => {
    setPlaces(await useCase.list());
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
    } catch (e) {
      setError(extractErrorMessage(e, '구매처를 추가하지 못했습니다.'));
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
    } catch (e) {
      setError(extractErrorMessage(e, '이름을 바꾸지 못했습니다.'));
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    const target = deleteTarget;
    setBusyId(target.id);
    setError('');
    try {
      await useCase.remove(target.id);
      setDeleteTarget(null);
      await refresh();
    } catch (e) {
      setDeleteTarget(null);
      setError(extractErrorMessage(e, '구매처를 삭제하지 못했습니다.'));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <PageContainer title="구매처 관리">
      <Card title="구매처">
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            물품 등록·수정 화면의 구매처 선택지입니다. 이름을 바꾸면 그 구매처를 쓰는 모든 물품에 바뀐 이름이 보입니다.
          </p>
          {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

          <div className="flex gap-2">
            <Input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="새 구매처 이름 (예: 홈플러스)"
            />
            <Button
              className="shrink-0"
              onClick={() => void handleCreate()}
              disabled={!newName.trim()}
              isLoading={isCreating}
              loadingText="추가 중..."
            >
              추가
            </Button>
          </div>

          {isLoading ? (
            <StateBlock variant="loading" message="불러오는 중..." />
          ) : places.length === 0 ? (
            <StateBlock variant="empty" message="등록된 구매처가 없습니다. 위에서 추가하세요." />
          ) : (
            <ul className="divide-y divide-gray-200 rounded-lg border border-gray-200">
              {places.map((place) => {
                const busy = busyId === place.id;
                const inUse = place.productCount > 0;
                return (
                  <li key={place.id} className="flex flex-wrap items-center gap-2 px-3 py-2">
                    {renamingId === place.id ? (
                      <>
                        <div className="min-w-0 flex-1">
                          <Input
                            size="sm"
                            value={renameDraft}
                            onChange={(e) => setRenameDraft(e.target.value)}
                          />
                        </div>
                        <Button
                          size="sm"
                          onClick={() => void handleRename(place.id)}
                          disabled={!renameDraft.trim()}
                          isLoading={busy}
                          loadingText="저장 중..."
                        >
                          저장
                        </Button>
                        <Button size="sm" variant="secondary" onClick={() => setRenamingId(null)}>
                          취소
                        </Button>
                      </>
                    ) : (
                      <>
                        <span className="min-w-0 flex-1 truncate text-sm text-gray-900">{place.name}</span>
                        <span className="shrink-0 text-xs text-gray-500">
                          {inUse ? `${place.productCount}개 물품이 사용 중` : '사용하는 물품 없음'}
                        </span>
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => {
                            setRenamingId(place.id);
                            setRenameDraft(place.name);
                          }}
                        >
                          이름 변경
                        </Button>
                        <Button
                          size="sm"
                          variant="danger"
                          onClick={() => setDeleteTarget(place)}
                          disabled={inUse || busy}
                          title={inUse ? `${place.productCount}개 물품이 사용 중이라 삭제할 수 없습니다` : undefined}
                        >
                          삭제
                        </Button>
                      </>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </Card>

      <ConfirmDialog
        isOpen={deleteTarget != null}
        title="구매처 삭제"
        message={`「${deleteTarget?.name ?? ''}」 구매처를 목록에서 지웁니다.`}
        confirmText="삭제"
        isDangerous
        isLoading={deleteTarget != null && busyId === deleteTarget.id}
        onConfirm={() => void handleDelete()}
        onCancel={() => setDeleteTarget(null)}
      />
    </PageContainer>
  );
}
