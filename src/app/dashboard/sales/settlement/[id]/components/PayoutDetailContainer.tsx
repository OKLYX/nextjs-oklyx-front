'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import axios from 'axios';
import { ArrowLeft } from 'lucide-react';
import { PageContainer } from '@/presentation/components/PageContainer';
import { Spinner } from '@/presentation/components/Spinner';
import { ROUTES } from '@/config/routes';
import { extractErrorMessage } from '@/infrastructure/utils/errorMessage';
import { SettlementUseCase } from '@/application/usecases/SettlementUseCase';
import { SettlementRepositoryImpl } from '@/infrastructure/repositories/SettlementRepositoryImpl';
import type { MonthCheck, ReconLineView, ReconReport } from '@/domain/entities/Settlement';
import {
  channelLabel,
  formatDateRange,
  formatMoney,
  formatSigned,
  payoutStatusLabel,
  settlementTypeLabel,
} from '@/domain/entities/Settlement';
import { PayoutOrderList } from './PayoutOrderList';
import { ReconBlockA } from './ReconBlockA';
import { ReconBlockB } from './ReconBlockB';
import { ExportButton } from './ExportButton';

/**
 * 지급 묶음 상세(차이 리포트) 화면의 상태 소유자 (FEATURE_2609_30 / 05 Step 3 · PLAN D11 · D12).
 *
 * 소유 상태 = 리포트 · 펼친 라벨 1개 + 그 라인 · 미분류 토글 · 엑셀 진행.
 *
 * 🔴 <b>진입 시 조회 API 만 부른다</b>(`/payouts/{id}/report`). 갱신(`POST /sync`)은 목록 화면의 버튼에만
 * 있고 이 화면 어디에도 없다 — 진입을 트리거로 걸면 상세를 열 때마다 마켓 호출이 나간다(D11).
 *
 * ⚠️ 라벨은 <b>한 번에 하나만</b> 펼친다. 라인은 라벨 단위로 지연 로드하고, 필터링은 서버가 한다
 * (`?label=` · `?unmatched=true`) — 화면에서 다시 거르면 라벨 금액과 목록이 어긋난다.
 * ⚠️ 라인 0건은 정상이다(D5-4). 갱신을 유도하지 않는다.
 */
interface PayoutDetailContainerProps {
  payoutId: number;
}

/** 파일명에 못 쓰는 문자만 걷어낸다(채널 별칭은 사용자가 자유롭게 적는다). */
const safeFileNamePart = (value: string): string => value.replace(/[\\/:*?"<>|]/g, '-').trim();

/** `2026-08` → `2026년 8월`. 🔴 형식이 다르면 원문 그대로 — 빈칸을 만들지 않는다(Settlement `label()` 관례). */
const monthLabel = (value: string | null): string => {
  if (!value) return '—';
  const matched = /^(\d{4})-(\d{2})$/.exec(value);
  return matched ? `${matched[1]}년 ${Number(matched[2])}월` : value;
};

/**
 * 인식월 참고 대조 한 줄 (FEATURE_2609_32 / PLAN 2609_32 D4·D4-1·D6·D8).
 *
 * 대조 불가 유형(추가정산·유보금)은 지급 건 단위로 대조할 수 없어 블록 A 에서 우리 집계를 지웠다.
 * 대신 <b>그 달 전체</b>로 보면 추가정산은 차이를 메우는 항목이라 따져볼 층이 생긴다.
 *
 * 🔴 <b>경고색을 쓰지 않는다</b>(D8). 우리 축은 라인의 인식일, 쿠팡 축은 지급 건의 인식월이라 완전히
 * 같지 않다 — 정상 상태에서도 0이 아닐 수 있는 참고 지표다. `차액`이 아니라 `차이`로 쓴다.
 * 🔴 `ourLineCount === 0` 은 <b>그 달 매출내역 미적재</b>다(D4-1). 서버가 `diff` 를 담아 보내도
 * 그리지 않는다 — 0원을 우리 집계인 척 보여주면 방금 지운 −전액이 한 줄 아래에서 부활한다.
 * 적재 유도는 상단의 `정산 내역` 링크(목록의 [과거 정산 불러오기])로 보낸다 — 백필 다이얼로그를
 * 이 화면에 <b>복제하지 않는다</b>(2609_31 이 소유자다).
 * 🔴 금액을 화면에서 다시 계산하지 않는다 — `diff` 는 서버 값을 그대로 쓴다.
 */
function MonthCheckRow({ monthCheck, typeLabel }: { monthCheck: MonthCheck; typeLabel: string }) {
  const loaded = monthCheck.ourLineCount > 0;
  return (
    <div className="bg-gray-50 border border-gray-200 rounded-lg px-4 py-3 text-sm text-gray-700 space-y-2">
      <div className="flex items-center gap-2">
        <span className="font-semibold text-gray-900">
          {monthLabel(monthCheck.revenueRecognitionMonth)} 전체 대조
        </span>
        <span className="px-2 py-0.5 text-xs rounded border bg-white text-gray-500 border-gray-200">
          참고
        </span>
      </div>

      <dl className="space-y-1">
        {loaded && (
          <div className="flex items-center justify-between">
            <dt>
              이 달 우리 집계{' '}
              <span className="text-xs text-gray-500">
                (판매 {monthCheck.ourLineCount.toLocaleString('ko-KR')}건)
              </span>
            </dt>
            <dd className="font-medium text-gray-900">{formatMoney(monthCheck.ourLineTotal)}</dd>
          </div>
        )}
        <div className="flex items-center justify-between">
          <dt>
            이 달 쿠팡 지급 합계{' '}
            <span className="text-xs text-gray-500">
              (지급 {monthCheck.payoutCount.toLocaleString('ko-KR')}건
              {/* 🔴 미수신 건을 밝히지 않으면 차이가 항상 우리 쪽 초과로 보인다(D6). */}
              {monthCheck.pendingPayoutCount > 0 &&
                ` · 지급액 미수신 ${monthCheck.pendingPayoutCount.toLocaleString('ko-KR')}건`}
              )
            </span>
          </dt>
          <dd className="font-medium text-gray-900">{formatMoney(monthCheck.payoutTotal)}</dd>
        </div>
        {loaded && (
          <div className="flex items-center justify-between">
            <dt>차이</dt>
            <dd className="font-medium text-gray-900">{formatSigned(monthCheck.diff)}</dd>
          </div>
        )}
      </dl>

      {loaded ? (
        <p className="text-xs text-gray-500">
          이 {typeLabel}은 이 지급 합계에 이미 포함돼 있습니다.
        </p>
      ) : (
        <p className="text-xs text-gray-500">
          이 달 매출내역을 아직 불러오지 않아 대조할 수 없습니다. 정산 내역 목록의 [과거 정산 불러오기]
          로 먼저 적재하세요.
        </p>
      )}
    </div>
  );
}

export function PayoutDetailContainer({ payoutId }: PayoutDetailContainerProps) {
  const settlementUseCase = useMemo(
    () => new SettlementUseCase(new SettlementRepositoryImpl()),
    []
  );

  const [report, setReport] = useState<ReconReport | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [reloadTick, setReloadTick] = useState(0);

  const [expandedLabel, setExpandedLabel] = useState('');
  const [unmatchedOnly, setUnmatchedOnly] = useState(false);
  const [lines, setLines] = useState<ReconLineView[]>([]);

  // 🔴 차이 리포트의 드릴다운(`lines`)과 <b>따로</b> 든다 — 저쪽은 라벨로 좁힌 목록이고 이쪽은 전체다.
  //    한 state 를 공유하면 라벨을 펼치는 순간 "이 정산에 포함된 주문"이 그 라벨만 남는다.
  const [orderLines, setOrderLines] = useState<ReconLineView[]>([]);
  const [orderLinesLoading, setOrderLinesLoading] = useState(false);
  const [orderLinesError, setOrderLinesError] = useState('');
  const [linesLoading, setLinesLoading] = useState(false);
  const [linesError, setLinesError] = useState('');

  const [exporting, setExporting] = useState(false);
  // 엑셀 실패·복사 결과는 화면 상태를 바꾸지 않는 짧은 안내다(Step 5).
  const [notice, setNotice] = useState('');

  const loadReport = useCallback(async () => {
    setIsLoading(true);
    setError('');
    try {
      setReport(await settlementUseCase.getReport(payoutId));
    } catch (e) {
      setError(extractErrorMessage(e, '차이 리포트 조회에 실패했습니다.'));
      setReport(null);
    } finally {
      setIsLoading(false);
    }
  }, [settlementUseCase, payoutId]);

  useEffect(() => {
    // 이펙트 본문에서 곧바로 setState 를 부르면 프로젝트 lint(`react-hooks/set-state-in-effect`)가
    // 막는다 — 조회를 useCallback 으로 감싸 effect 는 호출만 한다(04 와 같은 패턴).
    void (async () => {
      await loadReport();
    })();
  }, [loadReport, reloadTick]);

  // 필터 없이 전량 조회 — 서버는 label·unmatched 가 없으면 그 묶음의 라인을 그대로 돌려준다.
  const loadOrderLines = useCallback(async () => {
    setOrderLinesLoading(true);
    setOrderLinesError('');
    try {
      setOrderLines(await settlementUseCase.getPayoutLines(payoutId, {}));
    } catch (e) {
      setOrderLinesError(extractErrorMessage(e, '주문 목록 조회에 실패했습니다.'));
      setOrderLines([]);
    } finally {
      setOrderLinesLoading(false);
    }
  }, [settlementUseCase, payoutId]);

  useEffect(() => {
    // 이펙트 본문에서 곧바로 setState 를 부르면 프로젝트 lint(`react-hooks/set-state-in-effect`)가
    // 막는다 — 조회를 useCallback 으로 감싸 effect 는 호출만 한다.
    void (async () => {
      await loadOrderLines();
    })();
  }, [loadOrderLines, reloadTick]);

  const loadLines = useCallback(async () => {
    if (!unmatchedOnly && !expandedLabel) {
      setLines([]);
      return;
    }
    setLinesLoading(true);
    setLinesError('');
    try {
      setLines(
        await settlementUseCase.getPayoutLines(
          payoutId,
          unmatchedOnly ? { unmatched: true } : { label: expandedLabel }
        )
      );
    } catch (e) {
      setLinesError(extractErrorMessage(e, '판매 내역 조회에 실패했습니다.'));
      setLines([]);
    } finally {
      setLinesLoading(false);
    }
  }, [settlementUseCase, payoutId, expandedLabel, unmatchedOnly]);

  useEffect(() => {
    // 이펙트 본문에서 곧바로 setState 를 부르면 프로젝트 lint(`react-hooks/set-state-in-effect`)가
    // 막는다 — 조회를 useCallback 으로 감싸 effect 는 호출만 한다(04 와 같은 패턴).
    void (async () => {
      await loadLines();
    })();
  }, [loadLines]);

  const handleExpand = useCallback((label: string) => {
    setUnmatchedOnly(false);
    setExpandedLabel((prev) => (prev === label ? '' : label));
  }, []);

  const handleToggleUnmatched = useCallback(() => {
    setExpandedLabel('');
    setUnmatchedOnly((prev) => !prev);
  }, []);

  const handleShowUnmatched = useCallback(() => {
    setExpandedLabel('');
    setUnmatchedOnly(true);
  }, []);

  /** 이 화면의 목적이 "플랫폼에 문의"라 식별자 5종을 한 줄로 넘긴다. */
  const handleCopyIdentifiers = useCallback(async (line: ReconLineView) => {
    const text = [
      `주문번호 ${line.externalOrderId ?? '-'}`,
      `옵션ID ${line.platformOptionId ?? '-'}`,
      `인식일 ${line.recognitionDate ?? '-'}`,
      `지급일 ${line.settlementDate ?? '-'}`,
      `정산유형 ${settlementTypeLabel(line.settlementType)}`,
    ].join(' / ');
    try {
      await navigator.clipboard.writeText(text);
      setNotice('식별자를 복사했습니다.');
    } catch {
      setNotice('복사에 실패했습니다. 브라우저 권한을 확인하세요.');
    }
  }, []);

  const handleExport = useCallback(async () => {
    if (!report) return;
    setExporting(true);
    setNotice('');
    try {
      const blob = await settlementUseCase.exportReport(payoutId);
      const period = formatDateRange(
        report.payout.recognitionFrom,
        report.payout.recognitionTo
      ).replace(/\s/g, '');
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `정산_${safeFileNamePart(channelLabel(report.payout))}_${safeFileNamePart(period)}.xlsx`;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      // responseType 'blob' 이라 에러 본문도 Blob 이다 — 표준 메시지 파싱이 통하지 않는다.
      if (axios.isAxiosError(e) && e.response?.status === 429) {
        setNotice('쿠팡 호출이 일시 제한되었습니다. 잠시 후 다시 시도하세요.');
      } else {
        setNotice('엑셀 다운로드에 실패했습니다. 다시 시도해주세요.');
      }
    } finally {
      setExporting(false);
    }
  }, [settlementUseCase, payoutId, report]);

  if (isLoading && !report) {
    return (
      <PageContainer>
        <Spinner size={24} label="불러오는 중..." />
      </PageContainer>
    );
  }

  if (error || !report) {
    return (
      <PageContainer>
        <div className="bg-white rounded-lg shadow p-6 space-y-3">
          <p className="text-sm text-red-600">{error || '지급 묶음을 찾을 수 없습니다.'}</p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setReloadTick((tick) => tick + 1)}
              className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              다시 시도
            </button>
            <Link
              href={ROUTES.SETTLEMENT_PAYOUTS}
              className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-100"
            >
              목록으로
            </Link>
          </div>
        </div>
      </PageContainer>
    );
  }

  const payout = report.payout;
  const amountOnly = payout.reconStatus === 'AMOUNT_ONLY';
  /**
   * 🔴 원인이 없으면 원인 분석을 그리지 않는다(PLAN 2609_32 D9). 라인 0건·차액 0원이면 라벨이 0개고,
   *    그때 제목만 남은 섹션은 "대조했는데 결과가 없다"로 읽힌다 — 없는 항목이다.
   * 🔴 단, 미분류 목록의 렌더 주체가 블록 B 라 블록 A 의 [보기] 가 켜지면 살려 둔다(D9-1).
   */
  const hasCauses = report.blockB.labels.length > 0;
  const showBlockB = hasCauses || unmatchedOnly;

  return (
    <PageContainer>
      <div className="flex flex-wrap items-start gap-3">
        <div className="space-y-1">
          <Link
            href={ROUTES.SETTLEMENT_PAYOUTS}
            className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
          >
            <ArrowLeft size={14} />
            정산 내역
          </Link>
          <h1 className="text-2xl font-bold text-gray-900">
            {channelLabel(payout)} · {settlementTypeLabel(payout.settlementType)}
          </h1>
          <p className="text-sm text-gray-500">
            인식기간 {formatDateRange(payout.recognitionFrom, payout.recognitionTo)} · 지급일{' '}
            {payout.finalSettlementDate ?? payout.settlementDate ?? '—'} (
            {payoutStatusLabel(payout.status)}) · 지급액 {formatMoney(payout.finalAmount)}
          </p>
        </div>
        <div className="ml-auto">
          <ExportButton payoutId={payoutId} exporting={exporting} onExport={handleExport} />
        </div>
      </div>

      {notice && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 text-sm text-blue-800">
          {notice}
        </div>
      )}

      {/* 🔴 경고색 금지 — 정상 입금이고 쿠팡이 내역을 안 주는 것뿐이다(D5-5). */}
      {amountOnly && (
        <div className="bg-gray-50 border border-gray-200 rounded-lg px-4 py-3 text-sm text-gray-700">
          ⓘ 금액만 기록된 지급입니다 — 쿠팡이 어느 주문이 포함됐는지 알려주지 않아 판매 내역을 대조할 수
          없습니다.
        </div>
      )}

      {/* 🔴 대조 불가 유형에서만 서버가 채워 보낸다 — 주정산·월정산은 null 이라 그리지 않는다(D5). */}
      {report.monthCheck && (
        <MonthCheckRow
          monthCheck={report.monthCheck}
          typeLabel={settlementTypeLabel(payout.settlementType)}
        />
      )}

      {/* 🔴 차이 리포트보다 <b>먼저</b> 놓는다 — "이 돈이 어느 주문 값인가"가 "왜 어긋났나"보다 앞선다. */}
      <PayoutOrderList
        lines={orderLines}
        loading={orderLinesLoading}
        error={orderLinesError}
        onCopyIdentifiers={handleCopyIdentifiers}
      />

      <ReconBlockA blockA={report.blockA} onShowUnmatched={handleShowUnmatched} />

      {showBlockB && (
        <ReconBlockB
          blockB={report.blockB}
          expandedLabel={expandedLabel}
          unmatchedOnly={unmatchedOnly}
          lines={lines}
          linesLoading={linesLoading}
          linesError={linesError}
          onExpand={handleExpand}
          onToggleUnmatched={handleToggleUnmatched}
          onCopyIdentifiers={handleCopyIdentifiers}
        />
      )}
    </PageContainer>
  );
}
