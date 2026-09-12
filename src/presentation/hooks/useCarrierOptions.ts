'use client';

import { useEffect, useMemo, useState } from 'react';
import { ShippingLabelRepositoryImpl } from '@/infrastructure/repositories/ShippingLabelRepositoryImpl';
import { ShippingLabelUseCase } from '@/application/usecases/ShippingLabelUseCase';
import type { CarrierOption } from '@/application/dto/ShippingLabelDTOs';

/** 조회 결과 한 덩어리 — 어느 platform 의 결과인지 함께 들고 있어야 플랫폼 전환이 안전하다. */
interface CarrierEntry {
  platform: string;
  carriers: CarrierOption[];
  failed: boolean;
  loading: boolean;
}

/**
 * 택배사 목록 조회 훅 — 화면이 택배사를 고르게 하려면 여기서 받는다.
 *
 * **용도**: 백엔드 카탈로그(`GET /api/admin/shipping-labels/carrier-options?platform=`)를 불러
 * 드롭다운 옵션으로 준다. 서버가 이미 `registered` 먼저 → `display_order` 순으로 정렬해 보내므로
 * (PLAN 2609_37 D4) 프론트는 **다시 정렬하지 않는다**.
 *
 * **파일**: src/presentation/hooks/useCarrierOptions.ts
 *
 * **필수 사용 규칙**: 택배사 목록의 **유일한 출처**다. 화면마다 상수를 만들지 말 것
 * (PLAN 2609_37 D8 — 화면이 들고 있던 프론트 큐레이션 상수를 지우고 이 훅으로 왔다).
 *
 * **사용 예제**:
 * ```tsx
 * const { carriers, loading, failed } = useCarrierOptions(platform);
 * if (loading) return <select disabled><option>택배사를 불러오는 중…</option></select>;
 * carriers.map((c) => <option key={c.deliveryCompanyCode} value={c.deliveryCompanyCode}>
 *   {c.carrierName} ({c.deliveryCompanyCode})   // 라벨은 `이름 (코드)` (D14)
 * </option>);
 * ```
 *
 * ⚠️ `platform` 이 없으면 조회하지 않는다(빈 목록 + `loading=false`). 플랫폼이 바뀌면 다시 부른다.
 * ⚠️ 실패를 **던지지 않는다** — 빈 목록으로 떨어뜨린다. 목록이 비면 화면은 직접 입력 경로로 내려가
 * 사용자가 코드를 여전히 지정할 수 있다(D9 의 빈 목록과 같은 취급).
 * ⚠️ 그래서 빈 목록에는 "미지원 플랫폼(정상)" 과 "조회 실패" 두 가지가 섞인다 — 사용자가 드롭다운이
 * 사라진 이유를 알 수 있도록 `failed` 일 때만 화면이 안내 한 줄을 띄운다.
 * ❌ TanStack Query 를 쓰지 않는다(신규 기능 금지 — usecase 레이어 조립이 표준이다).
 */
export function useCarrierOptions(platform?: string): {
  carriers: CarrierOption[];
  loading: boolean;
  failed: boolean;
} {
  // 훅이 자기 호출만 소유한다 — 화면의 usecase 인스턴스와 독립(무상태 래퍼, `useOrderSync` 관례).
  const useCase = useMemo(() => new ShippingLabelUseCase(new ShippingLabelRepositoryImpl()), []);

  // 조회 결과를 platform 과 함께 한 덩어리로 들고, 화면에 내보내는 값은 파생시킨다.
  // 상태를 쪼개 두면 platform 이 바뀐 직후 한 프레임 동안 **이전 플랫폼의 목록**이 보인다.
  const [entry, setEntry] = useState<CarrierEntry | null>(null);

  useEffect(() => {
    // platform 이 없으면 조회하지 않는다. 여기서 초기화 setState 를 하지 않는 이유 = 아래 파생값이
    // platform 불일치를 이미 빈 목록으로 떨어뜨리기 때문(프로젝트 lint `set-state-in-effect`).
    if (!platform) return;
    // `alive` 로 언마운트 후 setState 를 막는다 — 플랫폼을 바꾸며 모달을 닫는 경로가 있다.
    let alive = true;
    void (async () => {
      setEntry({ platform, carriers: [], failed: false, loading: true });
      try {
        const options = await useCase.getCarrierOptions(platform);
        if (alive) setEntry({ platform, carriers: options, failed: false, loading: false });
      } catch {
        if (alive) setEntry({ platform, carriers: [], failed: true, loading: false });
      }
    })();
    return () => {
      alive = false;
    };
  }, [platform, useCase]);

  const current = platform && entry?.platform === platform ? entry : null;
  return {
    carriers: current?.carriers ?? [],
    // 아직 이 platform 의 조회가 시작되지 않은 프레임도 로딩으로 본다 — 화면이 빈 목록 분기로
    // 내려가 "직접 입력" 박스를 한 번 그렸다가 목록으로 바뀌는 깜빡임을 막는다.
    loading: platform ? (current?.loading ?? true) : false,
    failed: current?.failed ?? false,
  };
}
