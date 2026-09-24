'use client';

import { useState } from 'react';
import type { ProductImage } from '@/domain/entities/ProductImage';
import { Card } from '@/presentation/components/ui/Card';
import { ImageLightbox } from '@/presentation/components/ImageLightbox';
import { resolveThumbUrl } from '@/infrastructure/utils/thumbUrl';

/**
 * 대표 사진 고르기 (FEATURE_2609_69 / B).
 *
 * 🔴 「대표」는 플래그가 아니라 **갤러리 맨 앞 한 장**이라는 뜻이다(PLAN D13) — 목록에 보이는 사진.
 * 🔴 「사진」 이관을 끄면 버릴 쪽 사진은 고를 수 없다. 끄는 순간 흐려지고 선택이 남길 쪽으로 돌아간다
 *    (그대로 보내면 서버가 400 을 낸다 — 그 사진은 이관되지 않고 버릴 물품과 함께 묻힌다).
 *
 * 🔴 확대 보기: 타일을 누르는 자리는 이미 「대표로 지정」이 가져갔으므로, 확대는 타일 오른쪽 위
 *    돋보기 버튼이 따로 연다(공용 `ImageLightbox`). 남길·버릴 두 줄을 **한 묶음**으로 넘겨
 *    ◀▶ 로 양쪽 사진을 이어서 넘겨볼 수 있게 한다 — 같은 물건인지 가리는 것이 이 화면의 일이다.
 */
export interface MergeImagePickerProps {
  keepImages: ProductImage[];
  discardImages: ProductImage[];
  imagesTransferred: boolean;
  representativeImageId: number | null;
  onSelect: (imageId: number) => void;
  disabled?: boolean;
}

export function MergeImagePicker({
  keepImages,
  discardImages,
  imagesTransferred,
  representativeImageId,
  onSelect,
  disabled = false,
}: MergeImagePickerProps) {
  // 확대 보기는 남길·버릴을 이어 붙인 한 줄로 본다. 버릴 쪽 순번은 남길 쪽 장수만큼 밀린다.
  const [zoomIndex, setZoomIndex] = useState<number | null>(null);

  if (keepImages.length === 0 && discardImages.length === 0) return null;

  const zoomImages = [...keepImages, ...discardImages].map((image) => ({
    url: resolveThumbUrl(image.imageUrl),
    alt: '물품 사진',
  }));

  return (
    <Card title="대표 사진(목록에 보이는 사진)">
      <p className="mb-4 text-sm text-gray-600">
        병합하면 사진은 전부 남길 물품으로 옮겨집니다. 그중 목록에 보일 한 장을 고르세요. 사진
        오른쪽 위 돋보기를 누르면 크게 볼 수 있습니다.
        {!imagesTransferred && ' 「사진」 이관을 껐기 때문에 버릴 쪽 사진은 고를 수 없습니다.'}
      </p>
      <div className="space-y-4">
        <ImageRow
          label="남길 물품"
          images={keepImages}
          selectable={!disabled}
          representativeImageId={representativeImageId}
          onSelect={onSelect}
          zoomBaseIndex={0}
          onZoom={setZoomIndex}
        />
        <ImageRow
          label="버릴 물품"
          images={discardImages}
          selectable={!disabled && imagesTransferred}
          representativeImageId={representativeImageId}
          onSelect={onSelect}
          zoomBaseIndex={keepImages.length}
          onZoom={setZoomIndex}
        />
      </div>

      <ImageLightbox
        images={zoomImages}
        index={zoomIndex}
        onIndexChange={setZoomIndex}
        onClose={() => setZoomIndex(null)}
      />
    </Card>
  );
}

function ImageRow({
  label,
  images,
  selectable,
  representativeImageId,
  onSelect,
  zoomBaseIndex,
  onZoom,
}: {
  label: string;
  images: ProductImage[];
  selectable: boolean;
  representativeImageId: number | null;
  onSelect: (imageId: number) => void;
  zoomBaseIndex: number;
  onZoom: (index: number) => void;
}) {
  if (images.length === 0) return null;

  return (
    <div>
      <p className="mb-2 text-xs text-gray-500">{label}</p>
      <div className="flex flex-wrap gap-3">
        {images.map((image, index) => {
          const isRepresentative = image.id === representativeImageId;
          return (
            // 🔴 타일은 div 다 — 고르기 버튼 안에 돋보기 버튼을 넣을 수 없고(버튼 중첩),
            //    고르기가 막힌 줄에서도 확대는 되어야 하기 때문.
            <div
              key={image.id}
              className={`relative h-24 w-24 overflow-hidden rounded border-2 ${
                isRepresentative ? 'border-blue-600' : 'border-gray-200'
              }`}
            >
              <button
                type="button"
                disabled={!selectable}
                onClick={() => onSelect(image.id)}
                title={selectable ? '대표 사진으로 지정' : undefined}
                className={`block h-full w-full ${
                  selectable ? 'cursor-pointer' : 'cursor-not-allowed opacity-40'
                }`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element -- 갤러리 원본은 S3/로컬 혼용이라 next/image 로 못 태운다(기존 갤러리와 같은 규칙) */}
                <img
                  src={resolveThumbUrl(image.imageUrl)}
                  alt=""
                  className="h-full w-full object-cover"
                  draggable={false}
                />
              </button>
              <button
                type="button"
                onClick={() => onZoom(zoomBaseIndex + index)}
                aria-label="사진 크게 보기"
                title="크게 보기"
                className="absolute right-0.5 top-0.5 rounded bg-black/55 px-1 py-0.5 text-[11px] leading-none text-white hover:bg-black/75"
              >
                🔍
              </button>
              {isRepresentative && (
                <span className="absolute inset-x-0 bottom-0 bg-blue-600 py-0.5 text-center text-[10px] text-white">
                  대표
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
