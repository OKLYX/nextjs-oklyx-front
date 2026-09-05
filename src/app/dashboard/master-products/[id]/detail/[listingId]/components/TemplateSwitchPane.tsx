'use client';

import { useEffect, useState } from 'react';
import { Spinner } from '@/presentation/components/Spinner';
import type { GeneratedProductResponse } from '@/domain/entities/ListingRegistrationEntity';
import type { DetailTemplateResponse } from '@/domain/entities/DetailTemplateEntity';
import type { ListingRegistrationUseCase } from '@/application/usecases/ListingRegistrationUseCase';
import type { DetailContentUseCase } from '@/application/usecases/DetailContentUseCase';
import type { OnGenerated } from './DetailEditorTabs';

interface TemplateSwitchPaneProps {
  listingId: number;
  generated: GeneratedProductResponse; // source / detailTemplateId 판단용
  template: DetailTemplateResponse; // 현재 해석된 템플릿(이름 표시)
  listingUseCase: ListingRegistrationUseCase;
  detailUseCase: DetailContentUseCase;
  onGenerated: OnGenerated;
  onTemplateChanged: (next: DetailTemplateResponse) => void;
}

/**
 * "상세 페이지 > 템플릿 변경"(2609_20). 이 채널 셀에 적용할 상세 템플릿을 고르고,
 * 미리보기(비영속)로 확인한 뒤 [저장]/[취소].
 * File: src/app/dashboard/master-products/[id]/detail/[listingId]/components/TemplateSwitchPane.tsx
 *
 * 저장 전까지 서버에는 아무것도 반영되지 않는다(D4). 저장(D7)은 이 셀의
 * detailTemplateId 를 바꾸고 detail HTML 을 새 템플릿으로 재생성한다.
 */
export function TemplateSwitchPane({
  listingId,
  generated,
  template,
  listingUseCase,
  detailUseCase,
  onGenerated,
  onTemplateChanged,
}: TemplateSwitchPaneProps) {
  const [templates, setTemplates] = useState<DetailTemplateResponse[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(generated.detailTemplateId ?? null);
  const [previewHtml, setPreviewHtml] = useState('');
  const [isLoadingList, setIsLoadingList] = useState(true);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [listFailed, setListFailed] = useState(false);
  const [error, setError] = useState('');

  const isOverridden = generated.source === 'MANUAL_OVERRIDE';
  const isDirty = selectedId !== (generated.detailTemplateId ?? null);
  const busy = isLoadingList || isPreviewing || isSaving;

  // 드롭다운 목록(마운트 시 1회). 서브탭을 왕복하면 재마운트되어 다시 받는다 — 의도된 동작.
  useEffect(() => {
    let alive = true;
    (async () => {
      setIsLoadingList(true);
      try {
        const list = await detailUseCase.listTemplates();
        if (!alive) return;
        setTemplates(list.filter((t) => t.active));
        setListFailed(false);
      } catch {
        if (!alive) return;
        setListFailed(true);
        setError('템플릿 목록을 불러오지 못했습니다.');
      } finally {
        if (alive) setIsLoadingList(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [detailUseCase]);

  // 미리보기는 이 effect 하나가 전담한다 — 마운트 직후에도 현재 선택값으로 1회 로드된다.
  // alive 가드 필수: 드롭다운을 빠르게 두 번 바꾸면 늦게 도착한 이전 응답이 최신 HTML 을 덮는다.
  useEffect(() => {
    let alive = true;
    (async () => {
      setIsPreviewing(true);
      try {
        const res = await listingUseCase.previewDetail(listingId, selectedId ?? undefined);
        if (alive) {
          setPreviewHtml(res.html);
          setError('');
        }
      } catch {
        // 이전 HTML 은 지우지 않는다(빈 화면보다 낡은 미리보기가 낫다).
        if (alive) setError('미리보기를 불러오지 못했습니다.');
      } finally {
        if (alive) setIsPreviewing(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [listingUseCase, listingId, selectedId]);

  const handleSave = async () => {
    if (
      isOverridden &&
      !window.confirm(
        '직접 수정한 HTML 이 사라지고 선택한 템플릿의 자동생성본으로 대체됩니다. 계속하시겠습니까?',
      )
    ) {
      return;
    }
    setIsSaving(true);
    setError('');
    try {
      const res = await listingUseCase.updateDetailTemplate(listingId, { templateId: selectedId });
      onGenerated(res);
      // The PATCH already succeeded here; a failure below must not be reported as a save failure.
      try {
        // 구조 데이터 탭이 blocks 를 쓰므로 해석된 템플릿도 같이 갱신한다.
        onTemplateChanged(await listingUseCase.getResolvedDetailTemplate(listingId));
      } catch {
        setError('저장은 완료됐지만 구조 데이터 갱신에 실패했습니다. 새로고침해 주세요.');
      }
    } catch {
      setError('템플릿 변경을 저장하지 못했습니다.');
    } finally {
      setIsSaving(false);
    }
  };

  // 선택만 되돌린다. 미리보기 재조회는 위 effect 가 전담(직접 호출하면 중복 요청).
  const handleCancel = () => setSelectedId(generated.detailTemplateId ?? null);

  return (
    <div className="space-y-3">
      <p className="rounded bg-blue-50 px-3 py-2 text-xs text-blue-700">
        미리보기는 저장되지 않습니다. [저장]을 눌러야 이 채널 셀에 적용됩니다 — 다른 상품·다른
        채널에는 영향 없습니다.
      </p>

      {isOverridden && (
        <p className="rounded bg-amber-50 px-3 py-2 text-xs text-amber-700">
          이 셀은 HTML 직접수정 상태입니다. 템플릿을 저장하면 수정본이 사라집니다.
        </p>
      )}

      {error && <p className="rounded bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      <div className="flex flex-wrap items-center gap-2">
        <label className="text-xs font-medium text-gray-600" htmlFor="detail-template-select">
          상세 템플릿
        </label>
        <select
          id="detail-template-select"
          value={selectedId === null ? '' : String(selectedId)}
          onChange={(e) => setSelectedId(e.target.value === '' ? null : Number(e.target.value))}
          disabled={isLoadingList || listFailed || isSaving}
          className="rounded border border-gray-300 px-3 py-1.5 text-sm text-gray-900 disabled:bg-gray-100"
        >
          <option value="">{`기본값 사용 (계정/테넌트 기본: ${template.name})`}</option>
          {templates.map((t) => (
            <option key={t.id} value={t.id}>
              {`${t.name}${t.isDefault ? ' (기본)' : ''}`}
            </option>
          ))}
        </select>
        {isLoadingList && <Spinner label="목록 불러오는 중..." className="text-gray-500" />}
        {!isLoadingList && !listFailed && templates.length === 0 && (
          <span className="text-xs text-gray-500">선택 가능한 템플릿이 없습니다</span>
        )}
      </div>

      <div>
        <label className="mb-1 block text-xs font-medium text-gray-600">미리보기</label>
        {isPreviewing ? (
          <div className="flex min-h-40 items-center justify-center rounded border border-gray-200 bg-white">
            <Spinner size={24} label="불러오는 중..." />
          </div>
        ) : (
          // 백엔드 산출 HTML = 신뢰 소스이므로 dangerouslySetInnerHTML + 격리 컨테이너로 렌더.
          <div className="overflow-auto rounded border border-gray-200 bg-white p-4">
            <div dangerouslySetInnerHTML={{ __html: previewHtml }} />
          </div>
        )}
      </div>

      <div className="flex flex-wrap gap-2 border-t border-gray-100 pt-3">
        <button
          type="button"
          onClick={handleSave}
          disabled={!isDirty || busy || listFailed}
          className="flex items-center gap-1 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {isSaving ? <Spinner label="저장 중..." /> : '저장'}
        </button>
        <button
          type="button"
          onClick={handleCancel}
          disabled={!isDirty || busy}
          className="flex items-center gap-1 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 disabled:opacity-50"
        >
          취소
        </button>
      </div>
    </div>
  );
}
