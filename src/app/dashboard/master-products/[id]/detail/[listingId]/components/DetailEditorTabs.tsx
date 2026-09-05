'use client';

import { useState } from 'react';
import type { GeneratedProductResponse } from '@/domain/entities/ListingRegistrationEntity';
import type { DetailTemplateResponse } from '@/domain/entities/DetailTemplateEntity';
import type { ListingRegistrationUseCase } from '@/application/usecases/ListingRegistrationUseCase';
import type { DetailContentUseCase } from '@/application/usecases/DetailContentUseCase';
import { AutoPreviewPane } from './AutoPreviewPane';
import { StructuredDataPane } from './StructuredDataPane';
import { DetailPagePane } from './DetailPagePane';
import { ThumbnailPane } from './ThumbnailPane';

// The page owns `generated`; children lift updates via onGenerated.
export type OnGenerated = (next: GeneratedProductResponse) => void;

interface DetailEditorTabsProps {
  masterId: number;
  listingId: number;
  generated: GeneratedProductResponse;
  template: DetailTemplateResponse;
  listingUseCase: ListingRegistrationUseCase;
  detailUseCase: DetailContentUseCase;
  onGenerated: OnGenerated;
  // 템플릿이 바뀌면 페이지가 소유한 template 도 교체해야 한다(구조 데이터 탭이 blocks 를 쓴다).
  onTemplateChanged: (next: DetailTemplateResponse) => void;
}

type TabKey = 'preview' | 'structure' | 'detail' | 'thumbnail';

const TABS: { key: TabKey; label: string }[] = [
  { key: 'preview', label: '자동 미리보기' },
  { key: 'structure', label: '구조 데이터' },
  { key: 'detail', label: '상세 페이지' }, // 2609_20: 옛 'raw'(HTML 직접 수정) 자리
  { key: 'thumbnail', label: '썸네일' },
];

/**
 * 3층 편집 탭 셸. source 는 항상 `generated.source`로 파생(별도 prop/state 금지).
 * File: src/app/dashboard/master-products/[id]/detail/[listingId]/components/DetailEditorTabs.tsx
 */
export function DetailEditorTabs({
  masterId,
  listingId,
  generated,
  template,
  listingUseCase,
  detailUseCase,
  onGenerated,
  onTemplateChanged,
}: DetailEditorTabsProps) {
  const [tab, setTab] = useState<TabKey>('preview');

  return (
    <div className="rounded-lg bg-white shadow">
      <div className="flex gap-1 border-b border-gray-200 px-2">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={`-mb-px border-b-2 px-4 py-3 text-sm font-medium ${
              tab === t.key
                ? 'border-blue-600 text-blue-700'
                : 'border-transparent text-gray-500 hover:text-gray-800'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="p-4">
        {tab === 'preview' && (
          <AutoPreviewPane
            listingId={listingId}
            generated={generated}
            listingUseCase={listingUseCase}
          />
        )}
        {tab === 'structure' && (
          <StructuredDataPane
            masterId={masterId}
            listingId={listingId}
            template={template}
            generated={generated}
            listingUseCase={listingUseCase}
            detailUseCase={detailUseCase}
            onGenerated={onGenerated}
          />
        )}
        {tab === 'detail' && (
          <DetailPagePane
            listingId={listingId}
            generated={generated}
            template={template}
            listingUseCase={listingUseCase}
            detailUseCase={detailUseCase}
            onGenerated={onGenerated}
            onTemplateChanged={onTemplateChanged}
          />
        )}
        {tab === 'thumbnail' && (
          <ThumbnailPane
            listingId={listingId}
            generated={generated}
            useCase={listingUseCase}
            onGenerated={onGenerated}
          />
        )}
      </div>
    </div>
  );
}
