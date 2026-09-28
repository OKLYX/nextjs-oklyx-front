'use client';

import { useEffect, useState } from 'react';
import { Spinner } from '@/presentation/components/Spinner';
import { Button } from '@/presentation/components/ui/Button';
import type { ShippingLabelUseCase } from '@/application/usecases/ShippingLabelUseCase';
import type { CarrierOption, StoredInvoice } from '@/application/dto/ShippingLabelDTOs';
import { extractErrorMessage } from '@/infrastructure/utils/errorMessage';
import { InternalStageBadge } from './InternalStageBadge';

interface StoredInvoiceEditorProps {
  useCase: ShippingLabelUseCase;
  externalOrderId: string;
  /** 택배사 드롭다운. 빈 배열이면 [송장 수정]을 그리지 않는다. */
  carrierOptions: CarrierOption[];
  /** 저장이 성공하면 부른다 — 부모가 닫힐 때 목록을 다시 불러오게 표시한다. */
  onChanged: () => void;
}

/**
 * 내부 단계 주문의 송장 — 배송 묶음 1개 = 1줄 (FEATURE_2609_75 / D18).
 *
 * **용도**: 「내부 상품준비중」·「발송대기중」 동안 언제나 택배사·송장번호를 넣거나 고친다(E14 조회 · E12 저장).
 * 예약을 취소해도 송장은 남는다 — 이 송장으로 [저장된 송장으로 발송]을 한다.
 * **사용처**: 주문 상세 「송장」 · 출고관리 내부 단계 주문 줄의 [송장 수정](`StoredInvoiceModal`).
 * **파일**: src/app/dashboard/orders/components/StoredInvoiceEditor.tsx
 * ⚠️ ADMIN 전용 — 부모가 isAdmin 일 때만 렌더한다. useCase 는 부모 인스턴스를 받는다.
 * ⚠️ 실행 중(RUNNING) 거절·내부 단계 아님 거절은 서버 문구를 그대로 보인다(판정하지 않는다).
 * ❌ 결과 행 id 로 저장하지 않는다 — 경로 변수는 배송 묶음 id(`orderShipmentId`)다.
 */
export function StoredInvoiceEditor({ useCase, externalOrderId, carrierOptions, onChanged }: StoredInvoiceEditorProps) {
  const [invoices, setInvoices] = useState<StoredInvoice[]>([]);
  const [tick, setTick] = useState(0);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [carrierValue, setCarrierValue] = useState('');
  const [invoiceValue, setInvoiceValue] = useState('');
  const [savingId, setSavingId] = useState<number | null>(null);
  const [actionError, setActionError] = useState('');

  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        const list = await useCase.getStoredInvoices(externalOrderId);
        if (alive) setInvoices(list);
      } catch {
        if (alive) setInvoices([]);
      }
    })();
    return () => { alive = false; };
  }, [useCase, externalOrderId, tick]);

  const carrierName = (code: string | null) =>
    code == null ? '-' : (carrierOptions.find((o) => o.deliveryCompanyCode === code)?.carrierName ?? code);

  const open = (invoice: StoredInvoice) => {
    setEditingId(invoice.orderShipmentId);
    setCarrierValue(invoice.carrierCode ?? carrierOptions[0]?.deliveryCompanyCode ?? '');
    setInvoiceValue(invoice.invoiceNumber ?? '');
    setActionError('');
  };

  const save = async (invoice: StoredInvoice) => {
    try {
      setSavingId(invoice.orderShipmentId);
      setActionError('');
      await useCase.changeReservedInvoice(invoice.orderShipmentId, carrierValue, invoiceValue.trim());
      setEditingId(null);
      setTick((t) => t + 1);
      onChanged();
    } catch (err) {
      setActionError(extractErrorMessage(err, '송장 저장에 실패했습니다. 다시 시도해주세요.'));
    } finally {
      setSavingId(null);
    }
  };

  if (invoices.length === 0) return null;

  return (
    <div className="space-y-2">
      <h4 className="text-sm font-semibold text-gray-900">송장</h4>
      {actionError && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-800 text-sm">{actionError}</div>
      )}
      <div className="border border-gray-200 rounded-lg overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-100 border-b border-gray-200">
            <tr className="text-left text-xs font-medium text-gray-500">
              <th className="px-4 py-2">배송번호</th>
              <th className="px-4 py-2">택배사</th>
              <th className="px-4 py-2">송장번호</th>
              <th className="px-4 py-2" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 text-sm text-gray-900">
            {invoices.map((invoice) => (
              <tr key={invoice.orderShipmentId}>
                <td className="px-4 py-2 whitespace-nowrap">
                  {invoice.externalShipmentId}
                  <InternalStageBadge stage={invoice.internalStage} />
                </td>
                {editingId === invoice.orderShipmentId ? (
                  <td colSpan={3} className="px-4 py-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <select
                        value={carrierValue}
                        onChange={(e) => setCarrierValue(e.target.value)}
                        aria-label="택배사"
                        className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                      >
                        {carrierOptions.map((option) => (
                          <option key={option.deliveryCompanyCode} value={option.deliveryCompanyCode}>
                            {option.carrierName}
                          </option>
                        ))}
                      </select>
                      <input
                        type="text"
                        value={invoiceValue}
                        onChange={(e) => setInvoiceValue(e.target.value)}
                        aria-label="송장번호"
                        className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                      />
                      <Button
                        size="sm"
                        onClick={() => void save(invoice)}
                        disabled={carrierValue === '' || invoiceValue.trim() === '' || savingId !== null}
                      >
                        {savingId === invoice.orderShipmentId ? <Spinner label="저장 중..." /> : '저장'}
                      </Button>
                      <Button size="sm" variant="secondary" onClick={() => setEditingId(null)} disabled={savingId !== null}>
                        취소
                      </Button>
                    </div>
                  </td>
                ) : (
                  <>
                    <td className="px-4 py-2 whitespace-nowrap">{carrierName(invoice.carrierCode)}</td>
                    <td className="px-4 py-2 whitespace-nowrap">{invoice.invoiceNumber ?? '-'}</td>
                    <td className="px-4 py-2 text-right">
                      {carrierOptions.length > 0 && (
                        <Button size="sm" variant="secondary" onClick={() => open(invoice)} disabled={savingId !== null}>
                          송장 수정
                        </Button>
                      )}
                    </td>
                  </>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
