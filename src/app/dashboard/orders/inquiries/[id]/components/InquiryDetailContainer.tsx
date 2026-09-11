'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { useRouter } from 'next/navigation';
import { ROUTES } from '@/config/routes';
import { InquiryRepositoryImpl } from '@/infrastructure/repositories/InquiryRepositoryImpl';
import { InquiryUseCase } from '@/application/usecases/InquiryUseCase';
import type { Inquiry } from '@/domain/entities/InquiryEntity';
import { extractErrorMessage } from '@/infrastructure/utils/errorMessage';
import { useAuthStore } from '@/infrastructure/stores/authStore';
import { PageContainer } from '@/presentation/components/PageContainer';
import { Spinner } from '@/presentation/components/Spinner';
import { InquiryDetailHeader } from './InquiryDetailHeader';
import { InquiryThread } from './InquiryThread';
import { InquiryReplyComposer } from './InquiryReplyComposer';
import { InquiryOrderPanel } from './InquiryOrderPanel';

/** `ClaimActionPanel` 과 같은 문구 — 권한 오류는 서버 문구 대신 화면이 갖는다. */
const FORBIDDEN_MESSAGE = '이 작업은 관리자만 할 수 있습니다.';

interface InquiryDetailContainerProps {
  /** `Number(params.id)` — 숫자가 아니면 조회하지 않고 빈 상태를 그린다. */
  inquiryId: number;
}

/**
 * 고객문의 상세 (FEATURE_2609_23 / D16 — 모달이 아니라 페이지다).
 *
 * 좌측 스레드 · 우측 관련 주문의 2단 화면. 목록 상태에 의존하지 않으므로 딥링크로 들어와도
 * 똑같이 렌더된다.
 */
export function InquiryDetailContainer({ inquiryId }: InquiryDetailContainerProps) {
  const router = useRouter();
  const inquiryUseCase = useMemo(() => new InquiryUseCase(new InquiryRepositoryImpl()), []);
  /**
   * 답변 전송은 ADMIN 전용 엔드포인트다(PLAN §5). 서버의 `replyCapability` 판정에는 역할이 없어
   * 비-ADMIN 에게도 `canReply=true` 가 내려오므로, 다 쓰고 나서 403 을 맞지 않게 여기서 막는다.
   */
  const isAdmin = useAuthStore((s) => s.user?.role === 'ADMIN');

  const [inquiry, setInquiry] = useState<Inquiry | null>(null);
  const [typeLabelMap, setTypeLabelMap] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [sendError, setSendError] = useState('');
  // 502 = 전송 성공 여부 불명 → 재전송을 막는다(중복 전송이 되고 되돌릴 수 없다).
  const [sendLocked, setSendLocked] = useState(false);

  /**
   * ⚠️ 로딩·에러 플래그를 여기서 세우지 않는다 — 초기값이 이미 로딩 상태이고, 재시도는 핸들러가
   * 세운다. 이펙트에서 곧바로 setState 를 호출하면 프로젝트 lint(react-hooks/set-state-in-effect)에
   * 걸린다.
   */
  const load = useCallback(async () => {
    try {
      const [detail, catalog] = await Promise.all([
        inquiryUseCase.getInquiry(inquiryId),
        // 라벨용 보조 조회다 — 실패해도 페이지를 실패로 만들지 않는다(코드가 그대로 보일 뿐).
        inquiryUseCase.getTypes().catch(() => []),
      ]);
      setInquiry(detail);
      setTypeLabelMap(
        Object.fromEntries(
          inquiryUseCase.flattenTypes(catalog).map((option) => [option.code, option.label])
        )
      );
    } catch (err) {
      // 404 는 상태코드로만 가른다 — 메시지 문구로는 "없는 문의"와 "조회 실패"를 못 가른다.
      if (axios.isAxiosError(err) && err.response?.status === 404) {
        setNotFound(true);
        return;
      }
      setError(extractErrorMessage(err, '문의를 불러오지 못했습니다.'));
    } finally {
      setIsLoading(false);
    }
  }, [inquiryUseCase, inquiryId]);

  // Inline async IIFE — 02 의 InquiryContainer 와 같은 회피책이다(프로젝트 lint 가 이펙트 본문의
  // 동기 setState 를 거부한다).
  useEffect(() => {
    if (Number.isNaN(inquiryId)) return;
    void (async () => {
      await load();
    })();
  }, [inquiryId, load]);

  /**
   * 답변 전송(D17). 성공하면 **서버가 준 문의로 통째 교체**한다 — 스레드·상태·`replyCapability` 를
   * 로컬에서 조립하면 다음 조회와 어긋난다. 성공 후 목록으로 자동 이동하지 않는다(결과를 확인해야 한다).
   */
  const handleSend = useCallback(
    async (content: string) => {
      try {
        setIsSending(true);
        setSendError('');
        const updated = await inquiryUseCase.sendReply(inquiryId, content);
        setInquiry(updated);
      } catch (err) {
        // 401 은 다루지 않는다 — axiosInstance 인터셉터가 갱신·재시도하고 실패 시 /login 으로 보낸다.
        const status = axios.isAxiosError(err) ? err.response?.status : undefined;
        // 502 는 마켓 전송 결과가 불명이다 — 재시도를 권하면 중복 전송이 된다(다음 동기화가 정정한다).
        if (status === 502) setSendLocked(true);
        setSendError(
          status === 403
            ? FORBIDDEN_MESSAGE
            : extractErrorMessage(err, '답변 전송에 실패했습니다.')
        );
      } finally {
        setIsSending(false);
      }
    },
    [inquiryUseCase, inquiryId]
  );

  const handleRetry = () => {
    setIsLoading(true);
    setError('');
    setNotFound(false);
    void load();
  };

  // ⚠️ router.back() 을 쓰지 않는다 — 딥링크로 들어온 사용자가 사이트 밖으로 나간다.
  const goToList = () => router.push(ROUTES.ORDERS_INQUIRIES);

  const renderBody = () => {
    if (Number.isNaN(inquiryId)) {
      return (
        <div className="bg-white rounded-lg shadow p-8 text-center space-y-4">
          <p className="text-gray-500">잘못된 주소입니다.</p>
          <button
            type="button"
            onClick={goToList}
            className="px-4 py-2 text-sm font-medium border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-100 transition-colors"
          >
            목록으로
          </button>
        </div>
      );
    }

    if (isLoading) {
      // 2단 형태를 유지한 스켈레톤 — 로드 후 레이아웃이 튀지 않는다.
      return (
        <>
          <div className="bg-white rounded-lg shadow p-6 animate-pulse space-y-3">
            <div className="h-5 w-1/3 bg-gray-200 rounded" />
            <div className="h-4 w-1/2 bg-gray-100 rounded" />
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-7 bg-white rounded-lg shadow p-6 min-h-64 flex items-center justify-center text-gray-500">
              <Spinner size={24} label="불러오는 중..." />
            </div>
            <div className="lg:col-span-5 bg-white rounded-lg shadow p-6 min-h-64 animate-pulse space-y-3">
              <div className="h-4 w-1/2 bg-gray-200 rounded" />
              <div className="h-4 w-2/3 bg-gray-100 rounded" />
              <div className="h-4 w-1/3 bg-gray-100 rounded" />
            </div>
          </div>
        </>
      );
    }

    if (notFound) {
      return (
        <div className="bg-white rounded-lg shadow p-8 text-center space-y-4">
          <p className="text-gray-500">이 문의를 찾을 수 없습니다.</p>
          <button
            type="button"
            onClick={goToList}
            className="px-4 py-2 text-sm font-medium border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-100 transition-colors"
          >
            목록으로
          </button>
        </div>
      );
    }

    if (error) {
      return (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700 flex items-center justify-between gap-4">
          <span>{error}</span>
          <button
            type="button"
            onClick={handleRetry}
            className="px-3 py-1 text-sm font-medium border border-red-300 rounded hover:bg-red-100 transition-colors"
          >
            다시 시도
          </button>
        </div>
      );
    }

    if (!inquiry) return null;

    return (
      <>
        <InquiryDetailHeader
          inquiry={inquiry}
          typeLabel={typeLabelMap[inquiry.inquiryType] ?? inquiry.inquiryType}
        />
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-7">
            <InquiryThread
              inquiry={inquiry}
              footer={
                // capability 가 없으면(구버전 응답) 아무것도 그리지 않는다 — 모르는 상태에서
                // 입력창을 열지 않는 것이 이 화면의 전방호환 계약이다.
                isAdmin && inquiry.replyCapability ? (
                  <InquiryReplyComposer
                    capability={inquiry.replyCapability}
                    isSending={isSending}
                    isLocked={sendLocked}
                    error={sendError}
                    onSend={handleSend}
                  />
                ) : null
              }
            />
          </div>
          <div className="lg:col-span-5 lg:sticky lg:top-6 self-start">
            <InquiryOrderPanel inquiry={inquiry} />
          </div>
        </div>
      </>
    );
  };

  return (
    <PageContainer>
      <div>
        <button
          type="button"
          onClick={goToList}
          className="rounded border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-100 transition-colors"
        >
          ← 고객문의
        </button>
      </div>
      {renderBody()}
    </PageContainer>
  );
}
