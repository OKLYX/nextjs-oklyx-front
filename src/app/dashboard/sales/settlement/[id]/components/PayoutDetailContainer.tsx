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
  NO_TOTAL_NOTICE,
  channelLabel,
  defaultPaidOn,
  formatDateRange,
  formatMoney,
  formatSigned,
  marketName,
  payoutStatusText,
  settlementTypeLabel,
  withSubjectParticle,
} from '@/domain/entities/Settlement';
import { MarkPaidDialog } from './MarkPaidDialog';
import { PayoutOrderList } from './PayoutOrderList';
import { ReconBlockA } from './ReconBlockA';
import { ReconBlockB } from './ReconBlockB';
import { ExportButton } from './ExportButton';
import { Button } from '@/presentation/components/ui/Button';

/**
 * State owner of the payout detail (difference report) screen (FEATURE_2609_30 / 05 Step 3 · PLAN D11 · D12).
 *
 * Owned state = report · one expanded label + its lines · unmatched toggle · Excel progress · the 11st
 * 「지급 완료」 dialog and its save (FEATURE_2610_20 / D34 · D38 · D39).
 *
 * 🔴 <b>Entry calls lookup APIs only</b> (`/payouts/{id}/report`). The refresh (`POST /sync`) lives only on the list
 * screen's buttons and nowhere here — hooking it to entry would call the market every time a detail opens (D11).
 * The 11st 「지급 완료」 / 「지급 완료 취소」 buttons write the local payout only.
 *
 * ⚠️ <b>One label at a time</b> is expanded. Lines load lazily per label and the server filters them
 * (`?label=` · `?unmatched=true`) — filtering again on screen makes the label amount and the list disagree.
 * ⚠️ Zero lines is normal (D5-4). Do not push the user to refresh.
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
 * One recognition-month reference row (FEATURE_2609_32 / PLAN 2609_32 D4 · D4-1 · D6 · D8).
 *
 * Types that cannot be compared per payout (additional · reserve) had our total removed from block A. Seen over the
 * <b>whole month</b>, though, an additional payout fills a gap, so there is a layer worth checking.
 *
 * 🔴 <b>No warning color</b> (D8). Our axis is the lines' recognition date, the market's axis (`platform`, named by
 * {@link marketName} — FEATURE_2610_20 / D14) is the payouts' recognition month; they are not exactly the same, so
 * this is a reference that can be non-zero in a normal state. Write 「차이」, not 「차액」.
 * 🔴 `ourLineCount === 0` means <b>that month's revenue history is not loaded</b> (D4-1). Even when the server sends
 * a `diff`, it is not drawn — showing 0 won as our total revives, one row below, the "−full amount" just removed.
 * Loading is pointed to the 「정산 내역」 link at the top (the list's [과거 정산 불러오기]) — the backfill dialog is
 * <b>not copied</b> into this screen (2609_31 owns it).
 * 🔴 No amount is recomputed on screen — `diff` is the server's value as is.
 */
function MonthCheckRow({
  monthCheck,
  typeLabel,
  platform,
}: {
  monthCheck: MonthCheck;
  typeLabel: string;
  platform: string | null;
}) {
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
            이 달 {marketName(platform)} 지급 합계{' '}
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
  // Short notices that leave the screen state alone: Excel failure · copy result · [지급 완료 취소] failure
  // (Step 5 · FEATURE_2610_20 / D39).
  const [notice, setNotice] = useState('');

  // 11st 「지급 완료」 (FEATURE_2610_20 / D34 · D38 · D39): the date dialog and one save at a time.
  const [markOpen, setMarkOpen] = useState(false);
  const [marking, setMarking] = useState(false);
  const [markError, setMarkError] = useState('');

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
        setNotice(`${marketName(report.payout.platform)} 호출이 일시 제한되었습니다. 잠시 후 다시 시도하세요.`);
      } else {
        setNotice('엑셀 다운로드에 실패했습니다. 다시 시도해주세요.');
      }
    } finally {
      setExporting(false);
    }
  }, [settlementUseCase, payoutId, report]);

  /** [지급 완료] in the dialog → mark, re-read the report, close (D38). A failure stays in the dialog. */
  const handleMarkPaid = useCallback(
    async (paidOn: string) => {
      setMarking(true);
      setMarkError('');
      try {
        await settlementUseCase.markPaid(payoutId, paidOn);
        await loadReport();
        setMarkOpen(false);
      } catch (e) {
        setMarkError(extractErrorMessage(e, '지급 완료 저장에 실패했습니다.'));
      } finally {
        setMarking(false);
      }
    },
    [settlementUseCase, payoutId, loadReport]
  );

  /** [지급 완료 취소] → back to scheduled, re-read the report (D39). */
  const handleUnmarkPaid = useCallback(async () => {
    setMarking(true);
    setNotice('');
    try {
      await settlementUseCase.unmarkPaid(payoutId);
      await loadReport();
    } catch (e) {
      setNotice(extractErrorMessage(e, '지급 완료 취소에 실패했습니다.'));
    } finally {
      setMarking(false);
    }
  }, [settlementUseCase, payoutId, loadReport]);

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
          <div className="flex items-center gap-2 max-md:flex-wrap">
            <Button
              type="button"
              onClick={() => setReloadTick((tick) => tick + 1)}
            >
              다시 시도
            </Button>
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
  const noTotal = payout.reconStatus === 'NO_TOTAL';
  // 「지급 완료」 is a person's mark on 11st payouts only — Coupang reports its own status (D34).
  const markable = payout.platform === 'ELEVENST';
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
            판매기간 {formatDateRange(payout.recognitionFrom, payout.recognitionTo)} · 지급일{' '}
            {payout.finalSettlementDate ?? payout.settlementDate ?? '—'} (
            <span className={payout.paymentCheckNeeded ? 'text-amber-700' : undefined}>
              {payoutStatusText(payout)}
            </span>
            ) · 지급액 {formatMoney(payout.finalAmount)}
          </p>
        </div>
        <div className="ml-auto flex items-center gap-2 max-md:flex-wrap">
          {markable &&
            (payout.status === 'PAID' ? (
              <Button
                variant="secondary"
                onClick={handleUnmarkPaid}
                isLoading={marking}
                loadingText="취소 중..."
              >
                지급 완료 취소
              </Button>
            ) : (
              <Button
                onClick={() => {
                  setMarkError('');
                  setMarkOpen(true);
                }}
                disabled={marking}
              >
                지급 완료
              </Button>
            ))}
          <ExportButton payoutId={payoutId} exporting={exporting} onExport={handleExport} />
        </div>
      </div>

      {markOpen && (
        <MarkPaidDialog
          defaultDate={defaultPaidOn(payout.settlementDate)}
          saving={marking}
          error={markError}
          onConfirm={handleMarkPaid}
          onClose={() => {
            if (!marking) setMarkOpen(false);
          }}
        />
      )}

      {notice && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 text-sm text-blue-800">
          {notice}
        </div>
      )}

      {/* 🔴 No warning color — a normal payout whose breakdown the market does not give (D5-5). */}
      {amountOnly && (
        <div className="bg-gray-50 border border-gray-200 rounded-lg px-4 py-3 text-sm text-gray-700">
          ⓘ 금액만 기록된 지급입니다 — {withSubjectParticle(marketName(payout.platform))} 어느 주문이 포함됐는지
          알려주지 않아 판매 내역을 대조할 수 없습니다.
        </div>
      )}

      {/* 🔴 Not a warning — 11st sends no paid total to compare with (FEATURE_2610_20 / D29). */}
      {noTotal && (
        <div className="bg-gray-50 border border-gray-200 rounded-lg px-4 py-3 text-sm text-gray-700">
          ⓘ {NO_TOTAL_NOTICE}
        </div>
      )}

      {/* 🔴 대조 불가 유형에서만 서버가 채워 보낸다 — 주정산·월정산은 null 이라 그리지 않는다(D5). */}
      {report.monthCheck && (
        <MonthCheckRow
          monthCheck={report.monthCheck}
          typeLabel={settlementTypeLabel(payout.settlementType)}
          platform={payout.platform}
        />
      )}

      <ReconBlockA
        blockA={report.blockA}
        platform={payout.platform}
        onShowUnmatched={handleShowUnmatched}
      />

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

      {/* 🔴 목록은 <b>맨 아래</b>다(사용자 요청 2026-09-11) — 요약·원인 분석은 몇 줄이라 먼저 읽히고,
          수백 줄짜리 목록이 위에 있으면 그 둘에 닿으려고 매번 스크롤해야 한다. */}
      <PayoutOrderList
        lines={orderLines}
        loading={orderLinesLoading}
        error={orderLinesError}
        onCopyIdentifiers={handleCopyIdentifiers}
      />
    </PageContainer>
  );
}
