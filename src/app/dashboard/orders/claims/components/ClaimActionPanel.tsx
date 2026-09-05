'use client';

import { useMemo, useState } from 'react';
import axios from 'axios';
import { Spinner } from '@/presentation/components/Spinner';
import { useAuthStore } from '@/infrastructure/stores/authStore';
import { ClaimUseCase } from '@/application/usecases/ClaimUseCase';
import { ClaimRepositoryImpl } from '@/infrastructure/repositories/ClaimRepositoryImpl';
import { deliveryCompaniesFor } from '@/presentation/components/ShippingOverrideFields';
import { extractErrorMessage } from '@/infrastructure/utils/errorMessage';
import type {
  Claim,
  ClaimAction,
  ClaimActionPayload,
  ClaimActionResult,
} from '@/domain/entities/ClaimEntity';

/**
 * 클레임(반품·교환) 처리 액션 패널 — 상세 모달 본문 맨 아래에 붙는다 (FEATURE_2609_21 / PLAN D1).
 *
 * **용도**: 서버가 `claim.availableActions` 로 내려준 액션만 버튼으로 그리고, 실행 결과를 그 자리에
 * 반영한다. 반품·교환 공용이다 — 종류 분기는 하지 않는다(서버가 종류에 맞는 액션만 준다).
 *
 * **파일**: `src/app/dashboard/orders/claims/components/ClaimActionPanel.tsx`
 *
 * 🔴 **금지 패턴**
 * - `if (claim.platform === 'COUPANG')` — 무엇을 보여줄지는 전부 서버가 정한다(D1). 플랫폼 분기를
 *   한 줄이라도 넣으면 네이버가 붙는 날 화면을 다시 짠다.
 * - `switch (option.action)` — 분기는 `requires` 로만 한다. `action` 은 서버에 되돌려 보낼
 *   식별자일 뿐이고, 화면에 쓰는 말은 서버가 준 `label` 이다. 라벨 매핑 테이블을 만들지 말 것.
 * - 상태 뱃지 낙관적 갱신 — 마켓 상태는 다음 동기화가 가져온다(D7).
 *
 * ⚠️ 모르는 `requires` 값은 **버튼을 그리지 않는다**(PLAN §8). 입력 폼을 만들 수 없기 때문이며,
 * 서버가 새 값을 내려도 화면은 그 액션만 빠진 채 정상 동작한다.
 *
 * ⚠️ 패널은 ADMIN 에게만 보인다(D13). 서버도 비-ADMIN 에게는 빈 목록을 주지만, 액션 엔드포인트가
 * ADMIN 전용이라 버튼을 보여 놓고 403 을 받게 두지 않는다.
 *
 * **사용 예제**:
 * <ClaimActionPanel claim={claim} onActionDone={handleActionDone} />
 */
interface ClaimActionPanelProps {
  claim: Claim;
  /** 단건 재조회 결과(D8) — 컨테이너가 목록 1행과 열려 있는 모달을 함께 교체한다. */
  onActionDone: (updated: Claim) => void;
}

/**
 * 화면이 폼을 만들 수 있는 `requires` 값. `REJECT_CODE` 는 06(교환)에서 붙인다 — 지금은 서버가
 * 내려주지 않으므로 자연히 렌더되지 않는다.
 */
const SUPPORTED_REQUIRES: ClaimAction['requires'][] = ['NONE', 'INVOICE'];

const SUCCESS_MESSAGE = '처리 요청을 보냈습니다. 다음 동기화 후 상태가 갱신됩니다.';
const CONFLICT_MESSAGE = '이미 처리된 접수입니다.';
const FORBIDDEN_MESSAGE = '이 작업은 관리자만 할 수 있습니다.';

const EMPTY_FORM = { deliveryCompanyCode: '', invoiceNumber: '' };

type Banner =
  | { kind: 'success'; message: string }
  | { kind: 'error'; message: string; raw?: ClaimActionResult | null };

export function ClaimActionPanel({ claim, onActionDone }: ClaimActionPanelProps) {
  const isAdmin = useAuthStore((s) => s.user?.role === 'ADMIN');
  const claimUseCase = useMemo(() => new ClaimUseCase(new ClaimRepositoryImpl()), []);

  // 지금 입력 폼/확인을 펼친 액션 (null = 접힘)
  const [openAction, setOpenAction] = useState<ClaimAction | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [isSending, setIsSending] = useState(false);
  const [banner, setBanner] = useState<Banner | null>(null);

  const actions = useMemo(
    () => claim.availableActions.filter((a) => SUPPORTED_REQUIRES.includes(a.requires)),
    [claim.availableActions]
  );

  /**
   * 택배사 목록 = 배송 설정과 **같은 프론트 상수**(`COUPANG_DELIVERY_COMPANIES`, 쿠팡 문서의 정적
   * 코드표에서 큐레이션한 주요 국내 택배사). 조회 API 를 부르지 않는다(사용자 결정 2026-09-05).
   *
   * ⚠️ 사본을 만들지 말 것 — 이 화면과 배송 설정이 다른 택배사를 보여주게 된다.
   * ⚠️ 알려진 한계: 이 목록에 없는 택배사(백엔드 화이트리스트는 198개)는 고를 수 없다. 값 자체는
   * 서버가 `CoupangCourierCodes` 로 검증하므로 틀린 코드가 마켓까지 가지는 않는다.
   * TODO: 프론트 큐레이션 표와 백엔드 전량 표를 한 원천으로 합치는 것은 후속 리팩터링.
   */
  const carriers = useMemo(() => deliveryCompaniesFor(claim.platform), [claim.platform]);

  if (!isAdmin) return null;
  // 처리할 것이 없는 행이 대부분이라 빈 문구조차 잡음이 된다 — 패널 자체를 그리지 않는다.
  if (actions.length === 0) return null;

  /**
   * 버튼 클릭. 추가 입력도 없고 되돌릴 수도 있는 액션(`NONE` + `irreversible: false`)은 **그 자리에서
   * 실행**한다(프롬프트 Step 2 "NONE = 버튼만") — 되돌릴 수 있는 한 번의 클릭에 확인 단계를 얹으면
   * 사용자는 곧 그것을 읽지 않고 누른다. 그 외(입력이 필요하거나 되돌릴 수 없는 액션)만 펼친다.
   *
   * 액션을 바꾸면 폼을 초기화한다 — 회수송장에 적던 값이 다른 액션으로 새어 나가면 사용자는 자기가
   * 무엇을 보냈는지 알 수 없다.
   */
  const handleClick = (option: ClaimAction) => {
    if (option.requires === 'NONE' && !option.irreversible) {
      setOpenAction(null);
      setForm(EMPTY_FORM);
      void handleSubmit(option);
      return;
    }
    setOpenAction((prev) => (prev?.action === option.action ? null : option));
    setForm(EMPTY_FORM);
    setBanner(null);
  };

  /** 액션 성공(또는 409) 뒤 그 claim 만 다시 읽어 올린다(D8) — 목록 전체 재조회는 금지. */
  const refresh = async () => {
    try {
      onActionDone(await claimUseCase.getClaim(claim.id));
    } catch {
      // 재조회 실패는 액션 결과를 뒤집지 않는다 — 배너는 그대로 두고 화면만 낡은 채 남는다.
    }
  };

  const handleSubmit = async (option: ClaimAction) => {
    const payload: ClaimActionPayload =
      option.requires === 'INVOICE'
        ? {
            action: option.action,
            deliveryCompanyCode: form.deliveryCompanyCode,
            invoiceNumber: form.invoiceNumber.trim(),
          }
        : { action: option.action };

    try {
      setIsSending(true);
      setBanner(null);
      await claimUseCase.executeAction(claim.id, payload);
      setBanner({ kind: 'success', message: SUCCESS_MESSAGE });
      setOpenAction(null);
      setForm(EMPTY_FORM);
      await refresh();
    } catch (err) {
      // 401 은 다루지 않는다 — axiosInstance 인터셉터가 갱신·재시도하고, 실패하면 /login 으로 보낸다.
      const status = axios.isAxiosError(err) ? err.response?.status : undefined;
      if (status === 409) {
        // 형제 라인에서 이미 처리된 경우. 로컬에서 버튼만 감추면 나머지 액션이 낡은 채 남는다 —
        // 성공과 같은 경로로 재조회한다.
        setBanner({ kind: 'error', message: CONFLICT_MESSAGE });
        setOpenAction(null);
        await refresh();
      } else if (status === 403) {
        setBanner({ kind: 'error', message: FORBIDDEN_MESSAGE });
      } else if (status === 502) {
        // 마켓 원문을 우리 문구로 덮지 않는다(D15) — 접어서 함께 보여준다.
        const raw = (err as { response?: { data?: { data?: ClaimActionResult } } }).response?.data
          ?.data;
        setBanner({
          kind: 'error',
          message: extractErrorMessage(err, '마켓이 요청을 거절했습니다.'),
          raw: raw ?? null,
        });
      } else {
        setBanner({ kind: 'error', message: extractErrorMessage(err, '처리에 실패했습니다.') });
      }
    } finally {
      setIsSending(false);
    }
  };

  const isInvoiceReady = form.deliveryCompanyCode !== '' && form.invoiceNumber.trim() !== '';

  return (
    <div className="mt-6 border-t border-gray-200 pt-6">
      <h4 className="text-lg font-semibold text-gray-900">처리</h4>

      <div className="mt-3 flex flex-wrap gap-2">
        {actions.map((option) => {
          const isOpen = openAction?.action === option.action;
          return (
            <button
              key={option.action}
              onClick={() => handleClick(option)}
              disabled={isSending}
              className={`px-4 py-2 font-medium rounded-lg transition-colors disabled:cursor-not-allowed ${
                option.irreversible
                  ? 'bg-red-600 text-white hover:bg-red-700 disabled:bg-red-300'
                  : 'border border-gray-300 text-gray-700 hover:bg-gray-100 disabled:text-gray-400'
              } ${isOpen ? 'ring-2 ring-offset-1 ring-blue-400' : ''}`}
            >
              {option.label}
            </button>
          );
        })}
      </div>

      {/* 인라인 확장 — 모달 위에 모달을 띄우면 무엇에 대해 입력하는지 안 보인다. */}
      {openAction && (
        <div className="mt-4 rounded-lg border border-gray-200 bg-gray-50 p-4">
          {openAction.requires === 'INVOICE' && (
            <div className="flex flex-wrap items-center gap-3">
              {/* 값은 마켓 코드 자체다 — 사용자는 코드를 모르므로 이름으로 고르게 한다. */}
              <select
                value={form.deliveryCompanyCode}
                onChange={(e) => setForm((f) => ({ ...f, deliveryCompanyCode: e.target.value }))}
                disabled={isSending}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm disabled:bg-gray-100"
              >
                <option value="">택배사 선택</option>
                {carriers.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.name}
                  </option>
                ))}
              </select>

              {/* type="text": 송장 형식은 택배사마다 다르고 검증은 마켓이 한다. */}
              <input
                type="text"
                maxLength={50}
                placeholder="송장번호"
                value={form.invoiceNumber}
                onChange={(e) => setForm((f) => ({ ...f, invoiceNumber: e.target.value }))}
                disabled={isSending}
                className="w-56 px-3 py-2 border border-gray-300 rounded-lg text-sm disabled:bg-gray-100"
              />
            </div>
          )}

          {/* 지원하지 않는 플랫폼(=목록 없음). 서버가 그런 claim 에 INVOICE 액션을 주지 않으므로
              현재는 도달하지 않지만, 빈 드롭다운으로 막다른 길을 만들지 않기 위한 안내다. */}
          {openAction.requires === 'INVOICE' && carriers.length === 0 && (
            <p className="mt-2 text-sm text-gray-500">
              이 플랫폼의 택배사 목록이 없어 송장을 등록할 수 없습니다.
            </p>
          )}

          {/* 2단 확인(D10) — "정말 하시겠습니까?" 로는 아무것도 막지 못한다. 무엇을 확정하는지 실명으로. */}
          {openAction.irreversible && (
            <div className="mt-3 text-sm text-red-800 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
              <p className="font-medium">
                {claim.itemName ?? '상품 정보 없음'} · 수량 {claim.quantity}개
                {claim.returnShippingCharge != null &&
                  ` · 반품비 ${claim.returnShippingCharge.toLocaleString()}원`}
              </p>
              <p className="mt-1">이 반품을 승인하면 환불이 확정되며 되돌릴 수 없습니다.</p>
            </div>
          )}

          <div className="mt-4 flex items-center gap-2">
            {/* 기본 포커스는 취소 — 되돌릴 수 없는 쪽에 엔터가 떨어지면 안 된다. */}
            <button
              autoFocus
              onClick={() => {
                setOpenAction(null);
                setForm(EMPTY_FORM);
              }}
              disabled={isSending}
              className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-gray-100 transition-colors disabled:text-gray-400 disabled:cursor-not-allowed"
            >
              취소
            </button>
            {/* 전송 중 disable — 되돌릴 수 없는 액션에서 더블클릭은 실제 사고다(서버 409 는 최종 방어선). */}
            <button
              onClick={() => void handleSubmit(openAction)}
              disabled={isSending || (openAction.requires === 'INVOICE' && !isInvoiceReady)}
              className={`px-4 py-2 text-white font-medium rounded-lg transition-colors disabled:cursor-not-allowed ${
                openAction.irreversible
                  ? 'bg-red-600 hover:bg-red-700 disabled:bg-red-300'
                  : 'bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400'
              }`}
            >
              {isSending ? (
                <Spinner label="전송 중..." />
              ) : openAction.requires === 'INVOICE' ? (
                '등록'
              ) : (
                openAction.label
              )}
            </button>
          </div>
        </div>
      )}

      {banner && (
        <div
          className={`mt-4 rounded-lg border px-4 py-3 text-sm ${
            banner.kind === 'success'
              ? 'bg-green-50 border-green-200 text-green-800'
              : 'bg-red-50 border-red-200 text-red-800'
          }`}
        >
          <p>{banner.message}</p>
          {banner.kind === 'error' && banner.raw && (
            <details className="mt-2">
              <summary className="cursor-pointer text-red-700">쿠팡 응답 보기</summary>
              <p className="mt-1 break-all text-red-900">
                {banner.raw.resultCode ?? '-'} {banner.raw.resultMessage ?? ''}
              </p>
            </details>
          )}
        </div>
      )}
    </div>
  );
}
