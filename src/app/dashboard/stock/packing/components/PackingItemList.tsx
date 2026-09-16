'use client';

import { useEffect, useRef } from 'react';
import { Check, Package as PackageIcon } from 'lucide-react';

/**
 * 이 박스에 담을 것 — 사진 · 이름 · 담음/필요 **타일 그리드**
 * (FEATURE_2609_40 / PLAN D10 · D33, FEATURE_2609_54 / PLAN D2 · D3).
 *
 * 🔴 상태를 갖지 않는다. 값은 페이지가 소유하고 여기는 그리기만 한다.
 * 🔴 `activeRowKey` 강조가 기능이다 — 「숫자 + Enter = 수량 수정」이 **고른 줄 하나**(↑↓ 또는
 * 스캔으로 이동)에만 적용되므로(2609_40/D33 · 2609_53/D8), 무엇이 바뀌는지 화면에 보여야 한다.
 * 표에서 타일로 바뀌면서 강조는 **테두리**로 옮겼다(2609_54/D2).
 * 🔴 강조와 수량 수정 모두 **줄 key**(`orderLineId:productId`)로 다룬다. 물품 id 로 다루면 같은
 * 물품이 두 줄에 있을 때 어느 줄인지 정할 수 없다.
 * 🔴 담음 수량은 **큰 숫자 자체가 입력칸**이다(2609_54/D3). 숫자만 그리면 마우스로 고치는 길이
 * 사라진다 — 2609_53/D8 이 일부러 살려 둔 길이다.
 * 🔴 ↑↓ 는 **포커스를 옮기지 않는다**(2609_53/D5). 고른 타일이 화면 밖으로 나가지 않게
 * `scrollIntoView({ block: 'nearest' })` 만 쓴다 (`PendingParcelList` 와 같은 방식).
 */
export interface PackedRow {
  orderLineId: number;
  productId: number;
  productName: string;
  itemName: string;
  barcodeId: string | null;
  /** 물품 사진. 없으면 `null` → 회색 자리를 그린다 (2609_54/D2) */
  imageUrl: string | null;
  /** 지금까지 담은 수량 */
  packedQty: number;
  /** 이 박스에 담을 수 있는 수량(= 서버가 준 잔량) */
  remainingQty: number;
}

export interface PackingItemListProps {
  items: PackedRow[];
  /** 고른 줄 key = `orderLineId:productId`. 이 타일만 강조된다 */
  activeRowKey: string | null;
  /** 수량 직접 입력 — 첫 인자는 **줄 key** 다(물품 id 가 아니다) */
  onQuantityChange: (key: string, qty: number) => void;
}

export function PackingItemList({ items, activeRowKey, onQuantityChange }: PackingItemListProps) {
  // 타일이 많으면 고른 타일이 화면 밖으로 나간다 → 그 타일만 보이게 끌어온다(포커스 이동이 아니다)
  const activeTileRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    activeTileRef.current?.scrollIntoView({ block: 'nearest' });
  }, [activeRowKey]);

  if (items.length === 0) {
    return <div className="p-8 text-center text-gray-500">담을 물품이 없습니다</div>;
  }

  return (
    <div className="grid grid-cols-2 gap-3 xl:grid-cols-3">
      {items.map((item) => {
        const done = item.packedQty >= item.remainingQty;
        const key = `${item.orderLineId}:${item.productId}`;
        const highlighted = key === activeRowKey;
        return (
          <div
            key={key}
            ref={highlighted ? activeTileRef : undefined}
            className={`rounded-lg border p-3 ${done ? 'bg-gray-50' : 'bg-white'} ${
              highlighted ? 'border-amber-400 ring-2 ring-amber-400' : 'border-gray-200'
            }`}
          >
            {item.imageUrl ? (
              /* 🔴 `next/image` 를 쓰지 않는다: 사진은 S3 공개 버킷의 **임의 도메인**이라(2608_04)
                 도메인마다 `next.config` 에 등록해야 한다. 같은 화면의 상자 사진·상품 썸네일도
                 이미 `<img>` 다 — 한 화면에 두 방식이 섞이는 것이 더 나쁘다. */
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={item.imageUrl}
                alt={`${item.productName} 사진`}
                className="aspect-square w-full rounded bg-gray-100 object-contain"
              />
            ) : (
              <div className="flex aspect-square w-full items-center justify-center rounded bg-gray-100">
                <PackageIcon size={40} className="text-gray-400" aria-label="사진 없음" />
              </div>
            )}

            <div className="mt-2 flex items-start gap-1">
              {done && (
                <Check size={18} className="mt-0.5 shrink-0 text-green-600" aria-label="다 담음" />
              )}
              <span className="line-clamp-2 text-base font-semibold text-gray-900">
                {item.productName}
              </span>
            </div>
            <p className="truncate text-xs text-gray-500">{item.itemName}</p>

            <div className="mt-1 flex items-baseline gap-1">
              <input
                type="number"
                min={0}
                max={item.remainingQty}
                value={item.packedQty}
                onChange={(event) => onQuantityChange(key, Number(event.target.value))}
                aria-label={`${item.productName} 담은 수량`}
                className={`w-16 border-0 bg-transparent p-0 text-3xl font-bold tabular-nums focus:rounded focus:ring-2 focus:ring-blue-500 ${
                  done ? 'text-green-600' : 'text-gray-900'
                }`}
              />
              <span className={`text-2xl ${done ? 'text-green-600' : 'text-gray-500'}`}>
                / {item.remainingQty}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
