'use client';

import { useEffect, useMemo, useState } from 'react';
import { PurchasePlaceUseCase } from '@/application/usecases/PurchasePlaceUseCase';
import { PurchasePlaceRepositoryImpl } from '@/infrastructure/repositories/PurchasePlaceRepositoryImpl';
import type { PurchasePlace } from '@/domain/entities/PurchasePlace';

interface PurchasePlacesState {
  places: PurchasePlace[];
  loading: boolean;
  failed: boolean;
}

/**
 * 구매처 목록 조회 훅 (FEATURE_2609_76) — 물품 입력 화면이 구매처 체크 목록을 그리려면 여기서 받는다.
 *
 * **용도**: `GET /api/admin/purchase-places` 를 마운트 때 한 번 불러 체크 목록 선택지로 준다.
 * 서버가 목록 순서(`sortOrder`)로 보내므로 다시 정렬하지 않는다.
 * **파일**: src/presentation/hooks/usePurchasePlaces.ts
 * **쓰는 곳**: `ProductRegistrationForm` · `ProductEditForm`(→ `PurchasePlaceCheckboxes`).
 *
 * **사용 예제**:
 * ```tsx
 * const { places, loading, failed } = usePurchasePlaces();
 * <PurchasePlaceCheckboxes places={places} loading={loading} failed={failed} value={ids} onChange={setIds} />
 * ```
 *
 * ⚠️ 실패를 던지지 않는다 — `failed` 로 알린다. 화면은 체크 목록 자리에 안내 한 줄만 보인다.
 * ⚠️ 목록이 비어 있으면 서버가 기본 3개(이마트·코스트코·노브랜드)를 넣고 돌려준다(D19).
 * ❌ 구매처 선택지를 화면에 상수로 박지 말 것 — 목록은 업체가 설정 화면에서 늘린다(D2).
 * ❌ 관리(추가·이름 변경·삭제) 화면은 이 훅을 쓰지 않는다 — 결과를 다시 불러야 해서 `PurchasePlaceContainer` 가 usecase 를 직접 쓴다.
 */
export function usePurchasePlaces(): PurchasePlacesState {
  const useCase = useMemo(() => new PurchasePlaceUseCase(new PurchasePlaceRepositoryImpl()), []);
  const [state, setState] = useState<PurchasePlacesState>({ places: [], loading: true, failed: false });

  useEffect(() => {
    // `alive` — 응답 전에 화면을 떠나면 setState 하지 않는다.
    let alive = true;
    useCase.list().then(
      (places) => {
        if (alive) setState({ places, loading: false, failed: false });
      },
      () => {
        if (alive) setState({ places: [], loading: false, failed: true });
      },
    );
    return () => {
      alive = false;
    };
  }, [useCase]);

  return state;
}
