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
import type { ReconLineView, ReconReport } from '@/domain/entities/Settlement';
import {
  channelLabel,
  formatDateRange,
  formatMoney,
  payoutStatusLabel,
  settlementTypeLabel,
} from '@/domain/entities/Settlement';
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
      setLinesError(extractErrorMessage(e, '라인 조회에 실패했습니다.'));
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
  const noLines = payout.lineCount === 0;

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
          ⓘ 금액만 기록된 지급입니다 — 쿠팡이 어느 주문이 포함됐는지 알려주지 않아 판매 라인을 대조할 수
          없습니다.
        </div>
      )}

      <ReconBlockA blockA={report.blockA} onShowUnmatched={handleShowUnmatched} />

      {noLines ? (
        <section className="bg-white rounded-lg shadow p-6 space-y-1">
          <h2 className="text-lg font-semibold text-gray-900">왜 예상보다 적은가</h2>
          {/* 🔴 라인 0건은 정상이다(D5-4) — 갱신을 유도하지 않는다. */}
          <p className="text-sm text-gray-500">
            이 지급에는 판매 라인이 없습니다 (조정 항목만).
          </p>
        </section>
      ) : (
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
