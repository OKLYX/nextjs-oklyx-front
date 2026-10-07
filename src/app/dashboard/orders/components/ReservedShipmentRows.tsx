'use client';

import { Fragment, useState } from 'react';
import { Spinner } from '@/presentation/components/Spinner';
import { Button } from '@/presentation/components/ui/Button';
import type { ShippingLabelUseCase } from '@/application/usecases/ShippingLabelUseCase';
import type {
  CarrierOption,
  ReservedItemResult,
  ReservedShipmentRow,
  ReservedShipmentStatus,
} from '@/application/dto/ShippingLabelDTOs';
import { extractErrorMessage } from '@/infrastructure/utils/errorMessage';
import { formatKstWallClock, fromDateTimeLocal, toDateTimeLocal } from '@/infrastructure/utils/kstWallClock';

// 화면 문구의 단일 출처(PLAN §4-5). 서버 enum 원문을 그대로 보여주지 않는다.
const STATUS_LABEL: Record<ReservedShipmentStatus, string> = {
  SCHEDULED: '예약됨',
  RUNNING: '처리 중',
  DONE: '완료',
  STOPPED: '자동 재시도 중단',
  CANCELLED: '취소됨',
};

const RESULT_LABEL: Record<ReservedItemResult, string> = {
  PENDING: '대기',
  SUCCEEDED: '완료',
  FAILED: '실패',
  CANCELLED: '취소됨',
  EXTERNAL: '외부에서 처리됨',
  RELEASED: '예약 해제',
};

type Action = 'time' | 'invoice' | 'retry' | 'cancel';

export const isOpen = (row: ReservedShipmentRow) => row.result === 'PENDING' || row.result === 'FAILED';
const isEditable = (row: ReservedShipmentRow) =>
  row.status === 'SCHEDULED' && row.firstRunKind == null && row.result === 'PENDING';
// D18 🔁 — 송장은 실행 중(RUNNING)만 막는다.
const isInvoiceEditable = (row: ReservedShipmentRow) => isOpen(row) && row.status !== 'RUNNING';

interface ReservedShipmentRowsProps {
  rows: ReservedShipmentRow[];
  useCase: ShippingLabelUseCase;
  /** [송장 수정] 택배사 드롭다운. 빈 배열이면 [송장 수정]을 그리지 않는다(주문 상세의 기록 표가 그렇게 쓴다). */
  carrierOptions: CarrierOption[];
  /** 작업이 성공하면 부른다 — 부모가 행을 다시 불러온다. */
  onChanged: () => void;
}

/**
 * 예약 발송 행 표 (FEATURE_2609_75 / D15·D16·D18·D30).
 *
 * **용도**: 한 줄 = 주문(배송 묶음) 1개. 예정 시각·실행 시각·결과·송장·사유 + [시각 변경]·[송장 수정]·[다시 시도]·[예약 취소].
 * **사용처**: 출고관리 `ReservedShipmentPanel`(전체) · 주문 상세 `ReservedShipmentHistory`(그 주문).
 * **파일**: src/app/dashboard/orders/components/ReservedShipmentRows.tsx
 * ⚠️ ADMIN 전용 — 부모가 isAdmin 일 때만 렌더한다. useCase 는 부모 인스턴스를 받는다(새로 만들지 않는다).
 * ⚠️ 시각은 KST 벽시계 문자열이다 — `kstWallClock` 도우미로만 바꾼다(`new Date()` 금지).
 * ❌ 판정을 서버와 다르게 만들지 않는다 — 버튼 노출만 가르고 거절은 서버 문구를 그대로 보여준다.
 * ❌ 예약(묶음) 단위로 묶어 그리지 않는다 — 사용자 단위는 주문이다(D30).
 */
export function ReservedShipmentRows({ rows, useCase, carrierOptions, onChanged }: ReservedShipmentRowsProps) {
  const [busy, setBusy] = useState<{ id: number; action: Action } | null>(null);
  const [actionError, setActionError] = useState('');
  const [editing, setEditing] = useState<{ id: number; kind: 'time' | 'invoice' } | null>(null);
  const [timeValue, setTimeValue] = useState('');
  const [carrierValue, setCarrierValue] = useState('');
  const [invoiceValue, setInvoiceValue] = useState('');

  const act = async (row: ReservedShipmentRow, action: Action) => {
    try {
      setBusy({ id: row.id, action });
      setActionError('');
      if (action === 'time') await useCase.changeReservationTime(row.id, fromDateTimeLocal(timeValue));
      else if (action === 'invoice') {
        await useCase.changeReservedInvoice(row.orderShipmentId, carrierValue, invoiceValue.trim());
      } else if (action === 'retry') await useCase.retryReservation(row.id);
      else await useCase.cancelReservedItems(row.orderItemIds);
      setEditing(null);
      onChanged();
    } catch (err) {
      setActionError(extractErrorMessage(err, '처리에 실패했습니다. 다시 시도해주세요.'));
    } finally {
      setBusy(null);
    }
  };

  const openTime = (row: ReservedShipmentRow) => {
    setEditing({ id: row.id, kind: 'time' });
    setTimeValue(toDateTimeLocal(row.executeAt));
  };

  const openInvoice = (row: ReservedShipmentRow) => {
    setEditing({ id: row.id, kind: 'invoice' });
    setCarrierValue(row.carrierCode);
    setInvoiceValue(row.invoiceNumber ?? '');
  };

  const label = (row: ReservedShipmentRow, action: Action, text: string, loading: string) =>
    busy?.id === row.id && busy.action === action ? <Spinner label={loading} /> : text;

  return (
    <div className="space-y-2">
      {actionError && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-800 text-sm">{actionError}</div>
      )}
      <div className="border border-gray-200 rounded-lg overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-100 border-b border-gray-200">
            <tr className="text-left text-xs font-medium text-gray-500">
              <th className="px-4 py-2">주문번호</th>
              <th className="px-4 py-2">예정 시각</th>
              <th className="px-4 py-2">실행 시각</th>
              <th className="px-4 py-2">결과</th>
              <th className="px-4 py-2">송장</th>
              <th className="px-4 py-2">사유</th>
              <th className="px-4 py-2" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 text-sm text-gray-900">
            {rows.map((row) => (
              <Fragment key={row.id}>
                <tr>
                  <td className="px-4 py-2 whitespace-nowrap">{row.externalOrderId}</td>
                  <td className="px-4 py-2 whitespace-nowrap">{formatKstWallClock(row.executeAt)}</td>
                  <td className="px-4 py-2 whitespace-nowrap">{row.lastRunAt ? formatKstWallClock(row.lastRunAt) : '-'}</td>
                  <td className="px-4 py-2 whitespace-nowrap">
                    {RESULT_LABEL[row.result]}
                    {isOpen(row) && (row.status === 'RUNNING' || row.status === 'STOPPED') && (
                      <span className="ml-1 rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-700">
                        {STATUS_LABEL[row.status]}
                      </span>
                    )}
                    {row.firstRunKind === 'DELAYED' && (
                      <span className="ml-1 rounded-full bg-amber-50 px-2 py-0.5 text-xs text-amber-900">지연 실행</span>
                    )}
                  </td>
                  <td className="px-4 py-2 whitespace-nowrap">{row.invoiceNumber ?? '-'}</td>
                  <td className={`px-4 py-2 ${row.result === 'FAILED' ? 'text-red-700' : ''}`}>{row.failureReason ?? '-'}</td>
                  <td className="px-4 py-2">
                    <div className="flex flex-wrap justify-end gap-2">
                      {isEditable(row) && (
                        <Button size="sm" variant="secondary" onClick={() => openTime(row)} disabled={busy !== null}>
                          시각 변경
                        </Button>
                      )}
                      {isInvoiceEditable(row) && carrierOptions.length > 0 && (
                        <Button size="sm" variant="secondary" onClick={() => openInvoice(row)} disabled={busy !== null}>
                          송장 수정
                        </Button>
                      )}
                      {row.status === 'STOPPED' && row.result === 'FAILED' && (
                        <Button size="sm" onClick={() => void act(row, 'retry')} disabled={busy !== null}>
                          {label(row, 'retry', '다시 시도', '실행 중...')}
                        </Button>
                      )}
                      {isOpen(row) && row.status !== 'RUNNING' && (
                        <Button size="sm" variant="secondary" onClick={() => void act(row, 'cancel')} disabled={busy !== null}>
                          {label(row, 'cancel', '예약 취소', '처리 중...')}
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
                {editing?.id === row.id && (
                  <tr>
                    <td colSpan={7} className="px-4 py-2 bg-gray-50">
                      {editing.kind === 'time' ? (
                        <div className="flex flex-wrap items-center gap-2">
                          <input
                            type="datetime-local"
                            value={timeValue}
                            onChange={(e) => setTimeValue(e.target.value)}
                            aria-label="새 예약 시각"
                            className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                          />
                          <Button size="sm" onClick={() => void act(row, 'time')} disabled={timeValue === '' || busy !== null}>
                            {label(row, 'time', '저장', '저장 중...')}
                          </Button>
                          <Button size="sm" variant="secondary" onClick={() => setEditing(null)} disabled={busy !== null}>
                            취소
                          </Button>
                        </div>
                      ) : (
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
                            onClick={() => void act(row, 'invoice')}
                            disabled={carrierValue === '' || invoiceValue.trim() === '' || busy !== null}
                          >
                            {label(row, 'invoice', '저장', '저장 중...')}
                          </Button>
                          <Button size="sm" variant="secondary" onClick={() => setEditing(null)} disabled={busy !== null}>
                            취소
                          </Button>
                        </div>
                      )}
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
