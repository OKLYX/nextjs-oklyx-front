'use client';

import type { ProductImage } from '@/domain/entities/ProductImage';
import { Card } from '@/presentation/components/ui/Card';
import { resolveThumbUrl } from '@/infrastructure/utils/thumbUrl';

/**
 * 대표 사진 고르기 (FEATURE_2609_69 / B).
 *
 * 🔴 「대표」는 플래그가 아니라 **갤러리 맨 앞 한 장**이라는 뜻이다(PLAN D13) — 목록에 보이는 사진.
 * 🔴 「사진」 이관을 끄면 버릴 쪽 사진은 고를 수 없다. 끄는 순간 흐려지고 선택이 남길 쪽으로 돌아간다
 *    (그대로 보내면 서버가 400 을 낸다 — 그 사진은 이관되지 않고 버릴 물품과 함께 묻힌다).
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
  if (keepImages.length === 0 && discardImages.length === 0) return null;

  return (
    <Card title="대표 사진(목록에 보이는 사진)">
      <p className="mb-4 text-sm text-gray-600">
        병합하면 사진은 전부 남길 물품으로 옮겨집니다. 그중 목록에 보일 한 장을 고르세요.
        {!imagesTransferred && ' 「사진」 이관을 껐기 때문에 버릴 쪽 사진은 고를 수 없습니다.'}
      </p>
      <div className="space-y-4">
        <ImageRow
          label="남길 물품"
          images={keepImages}
          selectable={!disabled}
          representativeImageId={representativeImageId}
          onSelect={onSelect}
        />
        <ImageRow
          label="버릴 물품"
          images={discardImages}
          selectable={!disabled && imagesTransferred}
          representativeImageId={representativeImageId}
          onSelect={onSelect}
        />
      </div>
    </Card>
  );
}

function ImageRow({
  label,
  images,
  selectable,
  representativeImageId,
  onSelect,
}: {
  label: string;
  images: ProductImage[];
  selectable: boolean;
  representativeImageId: number | null;
  onSelect: (imageId: number) => void;
}) {
  if (images.length === 0) return null;

  return (
    <div>
      <p className="mb-2 text-xs text-gray-500">{label}</p>
      <div className="flex flex-wrap gap-3">
        {images.map((image) => {
          const isRepresentative = image.id === representativeImageId;
          return (
            <button
              key={image.id}
              type="button"
              disabled={!selectable}
              onClick={() => onSelect(image.id)}
              className={`relative h-24 w-24 overflow-hidden rounded border-2 ${
                isRepresentative ? 'border-blue-600' : 'border-gray-200'
              } ${selectable ? 'cursor-pointer' : 'cursor-not-allowed opacity-40'}`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- 갤러리 원본은 S3/로컬 혼용이라 next/image 로 못 태운다(기존 갤러리와 같은 규칙) */}
              <img
                src={resolveThumbUrl(image.imageUrl)}
                alt=""
                className="h-full w-full object-cover"
                draggable={false}
              />
              {isRepresentative && (
                <span className="absolute inset-x-0 bottom-0 bg-blue-600 py-0.5 text-center text-[10px] text-white">
                  대표
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
