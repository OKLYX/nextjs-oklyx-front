'use client';

import { useState } from 'react';
import type { GeneratedProductResponse } from '@/domain/entities/ListingRegistrationEntity';
import type { DetailTemplateResponse } from '@/domain/entities/DetailTemplateEntity';
import type { ListingRegistrationUseCase } from '@/application/usecases/ListingRegistrationUseCase';
import type { DetailContentUseCase } from '@/application/usecases/DetailContentUseCase';
import type { OnGenerated } from './DetailEditorTabs';
import { TemplateSwitchPane } from './TemplateSwitchPane';
import { RawHtmlPane } from './RawHtmlPane';

interface DetailPagePaneProps {
  listingId: number;
  generated: GeneratedProductResponse;
  template: DetailTemplateResponse;
  listingUseCase: ListingRegistrationUseCase;
  detailUseCase: DetailContentUseCase;
  onGenerated: OnGenerated;
  onTemplateChanged: (next: DetailTemplateResponse) => void;
}

type SubKey = 'template' | 'raw';

const SUBS: { key: SubKey; label: string }[] = [
  { key: 'template', label: '템플릿 변경' },
  { key: 'raw', label: 'HTML 직접수정' },
];

/**
 * 탭3 — "상세 페이지" 셸(2609_20). 서브탭 `템플릿 변경` / `HTML 직접수정`.
 * File: src/app/dashboard/master-products/[id]/detail/[listingId]/components/DetailPagePane.tsx
 *
 * 서브 패널은 조건부 렌더(마운트 교체)다. `RawHtmlPane` 이 마운트 시점의
 * `generated.detailHtml` 로 state 를 잡는데 템플릿 저장이 그 HTML 을 통째로 바꾸므로,
 * 마운트를 유지하면 낡은 HTML 이 다음 저장 때 새 템플릿 결과를 덮어쓴다(D7 무력화).
 * 대가로 미저장 편집분은 서브탭 이동 시 사라진다 → 버튼 title 로 경고.
 */
export function DetailPagePane({
  listingId,
  generated,
  template,
  listingUseCase,
  detailUseCase,
  onGenerated,
  onTemplateChanged,
}: DetailPagePaneProps) {
  const [sub, setSub] = useState<SubKey>('template');

  return (
    <div className="space-y-4">
      <div className="inline-flex rounded-lg bg-gray-100 p-1">
        {SUBS.map((s) => (
          <button
            key={s.key}
            type="button"
            onClick={() => setSub(s.key)}
            title="편집 중인 내용은 저장하지 않으면 사라집니다"
            className={
              sub === s.key
                ? 'rounded-md bg-white px-3 py-1.5 text-sm font-medium text-gray-900 shadow-sm'
                : 'rounded-md px-3 py-1.5 text-sm text-gray-500 hover:text-gray-800'
            }
          >
            {s.label}
          </button>
        ))}
      </div>

      {sub === 'template' ? (
        <TemplateSwitchPane
          listingId={listingId}
          generated={generated}
          template={template}
          listingUseCase={listingUseCase}
          detailUseCase={detailUseCase}
          onGenerated={onGenerated}
          onTemplateChanged={onTemplateChanged}
        />
      ) : (
        <RawHtmlPane
          listingId={listingId}
          generated={generated}
          listingUseCase={listingUseCase}
          onGenerated={onGenerated}
        />
      )}
    </div>
  );
}
