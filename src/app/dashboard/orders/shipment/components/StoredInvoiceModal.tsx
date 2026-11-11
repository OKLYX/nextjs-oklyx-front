'use client';

import { useEffect, useState } from 'react';
import { Modal } from '@/presentation/components/ui/Modal';
import type { ShippingLabelUseCase } from '@/application/usecases/ShippingLabelUseCase';
import type { CarrierOption } from '@/application/dto/ShippingLabelDTOs';
import { StoredInvoiceEditor } from '../../components/StoredInvoiceEditor';

interface StoredInvoiceModalProps {
  /** 송장을 고칠 주문번호. null = 닫힘. */
  externalOrderId: string | null;
  /** Market `Platform` name of the opened order line — the carrier list is that market's (FEATURE_2611_23 / D64 ②). */
  platform: string | null;
  useCase: ShippingLabelUseCase;
  /** 인자 = 한 번이라도 저장했는지(true 면 부모가 목록을 다시 불러온다). */
  onClose: (didChange: boolean) => void;
}

/**
 * 출고관리 내부 단계 주문 줄의 [송장 수정] 모달 (FEATURE_2609_75 / D18).
 *
 * **용도**: 줄에서 바로 그 주문의 배송 묶음별 송장을 고친다. 본문은 `StoredInvoiceEditor` 그대로.
 * **파일**: src/app/dashboard/orders/shipment/components/StoredInvoiceModal.tsx
 * ⚠️ ADMIN 전용 — 부모가 isAdmin 일 때만 렌더한다. 부모는 주문이 바뀔 때 `key` 로 다시 마운트한다.
 */
export function StoredInvoiceModal({ externalOrderId, platform, useCase, onClose }: StoredInvoiceModalProps) {
  const [carrierOptions, setCarrierOptions] = useState<CarrierOption[]>([]);
  const [changed, setChanged] = useState(false);

  // Carrier list of the order's market — on failure an empty list ([송장 수정] hides). Same call as the status card.
  useEffect(() => {
    if (externalOrderId == null || platform == null) return;
    let alive = true;
    void (async () => {
      try {
        const options = await useCase.getCarrierOptions(platform);
        if (alive) setCarrierOptions(options);
      } catch {
        if (alive) setCarrierOptions([]);
      }
    })();
    return () => { alive = false; };
  }, [useCase, externalOrderId, platform]);

  return (
    <Modal isOpen={externalOrderId != null} onClose={() => onClose(changed)} title="송장 수정">
      {externalOrderId != null && (
        <StoredInvoiceEditor
          useCase={useCase}
          externalOrderId={externalOrderId}
          carrierOptions={carrierOptions}
          onChanged={() => setChanged(true)}
        />
      )}
    </Modal>
  );
}
