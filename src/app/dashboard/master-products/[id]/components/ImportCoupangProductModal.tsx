'use client';

import { useEffect, useMemo, useState } from 'react';
import { Spinner } from '@/presentation/components/Spinner';
import { QuantityStepper } from '@/presentation/components/QuantityStepper';
import { ListingRegistrationUseCase } from '@/application/usecases/ListingRegistrationUseCase';
import { ListingRegistrationRepositoryImpl } from '@/infrastructure/repositories/ListingRegistrationRepositoryImpl';
import { extractErrorMessage } from '@/infrastructure/utils/errorMessage';
import type { ImportPreviewResponse } from '@/domain/entities/ListingRegistrationEntity';
import type { MasterOptionResponse } from '@/domain/entities/MasterProductEntity';
import { Button } from '@/presentation/components/ui/Button';
import { Modal } from '@/presentation/components/ui/Modal';

interface ImportCoupangProductModalProps {
  masterId: number;
  sellerId: number;
  platform: string;
  sellerName: string;
  /** 2609_74/D12: 이 마스터의 옵션(구성 수량 포함). 고르는 칸의 선택지다. */
  masterOptions: MasterOptionResponse[];
  /** 2609_74/D1: 미연결 판매상품을 골라 들어온 경우의 쿠팡 상품 ID. 있으면 열리자마자 조회한다. */
  initialProductId?: string;
  onClose: () => void;
  /** 성공 시 커밋 응답의 categoryWarning(없으면 null)을 매트릭스로 올린다. */
  onDone: (categoryWarning: string | null) => void;
}

// 상태 enum → 화면 문구. ⚠️ enum 원문을 사용자에게 노출하지 않는다(UI 용어 규칙).
// 매트릭스의 STATUS_LABEL 과 같은 표지만, CoverageMatrix 가 이 모달을 import 하므로
// 거기서 가져오면 순환 참조가 된다 → 이 한 줄짜리 표만 지역으로 둔다.
const STATUS_LABEL: Record<string, string> = {
  DRAFT: '미전송',
  SUBMITTED: '승인 대기중',
  SELLING: '판매중',
  REJECTED: '승인 반려',
  SUSPENDED: '판매 중지',
};

/**
 * 백엔드 메시지를 가공하지 않고 그대로 쓰되, 사용자가 조치할 수 있는 것만 한 줄을 덧붙인다.
 * 판정은 HTTP status + 메시지 substring 으로만 한다 — 프론트에는 예외 클래스명이 오지 않는다.
 *
 * ⚠️ 종전에 있던 409 `이미 등록된 채널` 가지는 **제거했다**(2026-09-23). 2026-09-19 온보딩에서
 * 편입 경로의 "계정당 상품페이지 1개" 가드가 풀려(`CoupangListingImportServiceImpl`) 이 경로는
 * 409 를 낼 수 없다 — 그 예외를 던지는 곳은 신규 등록(`ChannelAddServiceImpl`) 하나뿐이다.
 * 남겨 두면 "기존 셀을 지우세요" 라는 **틀린 안내**가 된다.
 */
const importErrorMessage = (e: unknown): string => {
  const status = (e as { response?: { status?: number } })?.response?.status;
  const message = extractErrorMessage(e, '가져오기에 실패했습니다.');
  if (status === 429) return '잠시 후 다시 시도하세요.';
  if (status === 400 && message.includes('이미 다른 상품에 연결된')) {
    // 2609_63: 이 400 은 여전히 발생한다(연결된 셀은 재사용 대상이 아니다) — 조치 방법만 덧붙인다.
    return `${message} 그 마스터에서 [마스터 연결 해제] 한 뒤 다시 시도하세요.`;
  }
  if ((status === 400 || status === 404) && message.includes('계정')) {
    return `${message} 판매자 관리에서 쿠팡 계정을 먼저 등록·활성화하세요.`;
  }
  return message;
};

/** 옵션 식별 키. 미승인 옵션은 vendorItemId 가 없어 itemName 으로 대신한다(서버 매칭 규칙과 동일). */
const optionKey = (o: ImportPreviewResponse['options'][number]) => o.vendorItemId ?? o.itemName;

interface OptionDraft {
  /** 2609_74/D12: 고른 마스터 옵션 id. 'new' = 같은 수량의 옵션이 없어 새로 만든다(D18). */
  masterOptionId: number | 'new';
  /** 새로 만들 때만 쓰는 이름(기본값 = 쿠팡 옵션명). 기존 옵션을 고르면 보내지 않는다. */
  masterOptionName: string;
  /** productId → 입력 문자열. 숫자 변환은 제출 직전에 한 번만(입력 중 변환은 지우는 순간 값이 튄다). */
  quantities: Record<number, string>;
}

/**
 * 2609_74/D31: 입력한 수량과 **구성이 완전히 같은** 마스터 옵션. 없으면 undefined.
 * 서버의 연결 규칙(`CoupangListingImportServiceImpl.resolveMasterOption`)과 같은 판정이다 —
 * 구성상품 집합이 같고 수량이 전부 같아야 한다.
 */
const matchMasterOption = (
  componentIds: number[],
  quantities: Record<number, string>,
  masterOptions: MasterOptionResponse[],
): MasterOptionResponse | undefined =>
  masterOptions.find(
    (o) =>
      o.items.length === componentIds.length &&
      componentIds.every(
        (id) => o.items.find((it) => it.productId === id)?.quantity === Number(quantities[id]),
      ),
  );

/** 미리보기 응답 → 옵션별 입력 초기값. 수량은 전부 1 로 시작하고, 그 구성과 같은 옵션을 골라 둔다. */
const buildDraft = (
  res: ImportPreviewResponse,
  masterOptions: MasterOptionResponse[],
): Record<string, OptionDraft> => {
  const componentIds = res.components.map((c) => c.productId);
  return Object.fromEntries(
    res.options.map((o) => {
      const quantities = Object.fromEntries(componentIds.map((id) => [id, '1']));
      return [
        optionKey(o),
        {
          masterOptionId: matchMasterOption(componentIds, quantities, masterOptions)?.id ?? 'new',
          masterOptionName: o.itemName,
          quantities,
        },
      ];
    }),
  );
};

const isPositiveInt = (raw: string) => {
  const v = Number(raw);
  return raw.trim() !== '' && Number.isInteger(v) && v >= 1;
};

/**
 * 「마켓 상품 추가하기」 창 (2609_22 → 2609_79 / UX D42·D78) — 이미 마켓에 있는 상품을 **기존 마스터**에 붙이는
 * 공유 창. 여는 곳 셋: 마스터 상세 판매채널 줄 [마켓 상품 추가하기] · [미연결 판매상품 연결] ·
 * 「마켓 상품으로 시작」 [이 마스터에 붙이기]. ❌ 여는 곳마다 창을 따로 만들지 말 것.
 * File: src/app/dashboard/master-products/[id]/components/ImportCoupangProductModal.tsx
 *
 * 이미 쿠팡에 올라가 있는 상품을 이 마스터의 채널 셀로 편입한다. 2단계 — ① 상품 ID 로 조회
 * ② 옵션마다 마스터 옵션을 고르거나 구성 수량을 채워 [가져오기](2609_74 — 둘은 항상 일치한다).
 * - 판매자·플랫폼은 매트릭스 행에서 받아 고정 표시한다(모달에 선택 UI 없음).
 * - 단계는 `preview` 유무로만 갈린다(별도 step state 금지 — 조회 실패 후 되돌아갈 자리가 하나여야 한다).
 * - ⚠️ 판매가·재고 입력칸을 만들지 않는다. 서버가 커밋 시점에 쿠팡을 재조회해 확정한다.
 * - ⚠️ 미리보기 응답을 캐시하지 않는다(가격·재고는 변한다). 모달을 닫으면 버린다.
 * - `categoryWarning` 은 가공하지 않고 그대로 출력한다.
 */
export function ImportCoupangProductModal({
  masterId,
  sellerId,
  platform,
  sellerName,
  masterOptions,
  initialProductId,
  onClose,
  onDone,
}: ImportCoupangProductModalProps) {
  const useCase = useMemo(
    () => new ListingRegistrationUseCase(new ListingRegistrationRepositoryImpl()),
    [],
  );

  const [productId, setProductId] = useState(initialProductId ?? '');
  const [preview, setPreview] = useState<ImportPreviewResponse | null>(null);
  const [draft, setDraft] = useState<Record<string, OptionDraft>>({});
  // 미연결 판매상품을 골라 들어왔으면 열리자마자 조회한다 → 처음부터 조회 중이다.
  const [busy, setBusy] = useState(initialProductId != null);
  const [error, setError] = useState('');

  // 2609_74/D1: 미연결 판매상품을 골라 들어온 경우의 첫 조회. 상품 ID 를 손으로 넣는 경로는 handleLookup.
  useEffect(() => {
    if (initialProductId == null) return;
    let alive = true;
    void (async () => {
      try {
        const res = await useCase.importPreview(masterId, {
          sellerId,
          platform,
          platformProductId: initialProductId,
        });
        if (!alive) return;
        setPreview(res);
        setDraft(buildDraft(res, masterOptions));
      } catch (e: unknown) {
        if (!alive) return;
        setError(importErrorMessage(e));
      } finally {
        if (alive) setBusy(false);
      }
    })();
    return () => {
      alive = false;
    };
    // masterOptions 는 첫 조회의 초기값에만 쓴다 — 부모가 다시 그릴 때마다 조회를 되풀이하지 않는다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialProductId, useCase, masterId, sellerId, platform]);

  const handleLookup = async () => {
    setBusy(true);
    setError('');
    // 상품 ID 를 고쳐 다시 조회하면 이전 결과·입력값을 함께 버린다.
    setPreview(null);
    setDraft({});
    try {
      const res = await useCase.importPreview(masterId, {
        sellerId,
        platform,
        platformProductId: productId.trim(),
      });
      setPreview(res);
      setDraft(buildDraft(res, masterOptions));
    } catch (e: unknown) {
      setError(importErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const rowOf = (key: string): OptionDraft =>
    draft[key] ?? { masterOptionId: 'new', masterOptionName: '', quantities: {} };

  const patchRow = (key: string, patch: Partial<OptionDraft>) =>
    setDraft((prev) => ({ ...prev, [key]: { ...rowOf(key), ...patch } }));

  // 이름은 새 옵션을 만들 때만 필요하다 — 기존 옵션을 고른 줄은 그 옵션의 이름을 쓴다.
  const nameMissing =
    preview != null &&
    preview.options.some((o) => {
      const row = rowOf(optionKey(o));
      return row.masterOptionId === 'new' && row.masterOptionName.trim() === '';
    });
  const quantityInvalid =
    preview != null &&
    preview.options.some((o) =>
      preview.components.some((c) => !isPositiveInt(rowOf(optionKey(o)).quantities[c.productId] ?? '')),
    );
  const canImport = preview != null && !nameMissing && !quantityInvalid && !busy;

  const handleImport = async () => {
    if (preview == null || busy) return;
    setBusy(true);
    setError('');
    try {
      const res = await useCase.importListing(masterId, {
        sellerId,
        platform,
        platformProductId: productId.trim(),
        options: preview.options.map((o) => {
          const row = rowOf(optionKey(o));
          const picked = masterOptions.find((m) => m.id === row.masterOptionId);
          return {
            vendorItemId: o.vendorItemId,
            itemName: o.itemName,
            // 서버는 이 값을 새 옵션을 만들 때만 쓴다(구성이 같으면 기존 옵션에 연결). 빈 값은 거절되므로
            // 기존 옵션을 고른 줄은 그 옵션의 이름을 그대로 보낸다.
            masterOptionName: picked ? picked.name : row.masterOptionName.trim(),
            components: preview.components.map((c) => ({
              productId: c.productId,
              quantity: Number(row.quantities[c.productId]),
            })),
          };
        }),
      });
      // ⚠️ 커밋은 쿠팡을 재조회하므로 미리보기에 없던 경고가 여기서 처음 올 수 있다.
      onDone(res.categoryWarning ?? null);
      onClose();
    } catch (e: unknown) {
      setError(importErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      isOpen
      onClose={onClose}
      title="마켓 상품 추가하기"
      disableClose={busy}
    >
      <p className="truncate text-xs text-gray-500">
        {sellerName} · {platform}
      </p>

      <div className="mb-3 flex shrink-0 items-center gap-2">
        <label className="text-sm text-gray-700" htmlFor="coupang-product-id">
          쿠팡 상품 ID
        </label>
        <input
          id="coupang-product-id"
          type="text"
          inputMode="numeric"
          disabled={busy || initialProductId != null}
          className="w-48 rounded border border-gray-300 px-2 py-1 text-sm text-gray-900 disabled:bg-gray-100"
          value={productId}
          onChange={(e) => setProductId(e.target.value)}
        />
        <button
          type="button"
          onClick={handleLookup}
          disabled={productId.trim() === '' || busy || initialProductId != null}
          className="flex items-center gap-1 rounded border border-blue-300 px-3 py-1 text-sm font-medium text-blue-700 hover:bg-blue-50 disabled:opacity-50"
        >
          {busy && preview == null ? '조회 중…' : '조회'}
        </button>
      </div>

      {error && (
        <p className="mb-3 shrink-0 rounded bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      )}

      {preview && (
        <>
          <div className="shrink-0 space-y-2">
            <p className="text-sm text-gray-900">
              <span className="font-medium">{preview.productName}</span>
              <span className="text-gray-500">
                {' '}
                · {STATUS_LABEL[preview.status] ?? preview.status} · 카테고리 {preview.categoryCode}{' '}
                · 태그 {preview.channelTags.length}개
              </span>
            </p>
            {/* 2609_63/D11: 경고가 아니라 사실 안내라 categoryWarning(amber)과 다른 색을 쓴다.
                뒷문장은 실제 동작이다 — 편입은 판매가·옵션명을 채널 지정값으로 넣고 재생성이 그 둘을
                건너뛴다. 🔴 되돌리는 창구는 이미 있다([기본값으로 변경]·[옵션명 일괄 적용]). */}
            {preview.reusesExistingListing && (
              <p className="rounded bg-blue-50 px-3 py-2 text-sm text-blue-700">
                이 쿠팡 상품에는 마스터 연결이 끊긴 판매상품이 있습니다. 새로 만들지 않고 그 판매상품을
                이 마스터에 다시 붙입니다 — 주문·고객문의·정산 기록이 함께 따라옵니다. 판매가·옵션명은
                쿠팡의 현재 값으로 들어오니, 이 마스터 기준으로 자동 계산하려면 가져온 뒤 [가격 설정] →
                [기본값으로 변경] 을 누르세요.
              </p>
            )}
            {preview.categoryWarning && (
              <p className="rounded bg-amber-50 px-3 py-2 text-sm text-amber-700">
                {preview.categoryWarning}
              </p>
            )}
          </div>

          <ul className="my-3 min-h-0 flex-1 space-y-3 overflow-y-auto">
            {preview.options.map((o) => {
              const key = optionKey(o);
              const row = rowOf(key);
              const componentIds = preview.components.map((c) => c.productId);
              return (
                <li key={key} className="rounded border border-gray-200 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="min-w-0 truncate text-sm font-medium text-gray-900">
                      {o.itemName}
                    </span>
                    <span className="shrink-0 text-xs text-gray-500">
                      판매가 {o.salePrice.toLocaleString('ko-KR')}
                      {o.stockQuantity != null && ` · 재고 ${o.stockQuantity}`}
                    </span>
                  </div>

                  <div className="mt-2 flex items-center gap-2">
                    <span className="shrink-0 text-xs text-gray-500">마스터 옵션</span>
                    <select
                      disabled={busy}
                      aria-label={`${o.itemName} 마스터 옵션`}
                      className="min-w-0 flex-1 rounded border border-gray-300 px-2 py-1 text-sm text-gray-900 disabled:bg-gray-100"
                      value={String(row.masterOptionId)}
                      onChange={(e) => {
                        const picked = masterOptions.find((m) => String(m.id) === e.target.value);
                        // 'new' 는 직접 고를 수 없다(아래 disabled) — 여기 오는 값은 항상 기존 옵션이다.
                        if (!picked) return;
                        patchRow(key, {
                          masterOptionId: picked.id,
                          quantities: Object.fromEntries(
                            componentIds.map((id) => [
                              id,
                              String(picked.items.find((it) => it.productId === id)?.quantity ?? 1),
                            ]),
                          ),
                        });
                      }}
                    >
                      {masterOptions.map((m) => (
                        <option key={m.id} value={String(m.id)}>
                          {m.name} ({m.items.map((it) => `${it.productName}×${it.quantity}`).join(', ')})
                        </option>
                      ))}
                      <option value="new" disabled={row.masterOptionId !== 'new'}>
                        새 옵션 만들기
                      </option>
                    </select>
                  </div>
                  {row.masterOptionId === 'new' && (
                    <>
                      <div className="mt-2 flex items-center gap-2">
                        <span className="shrink-0 text-xs text-gray-500">새 옵션 이름</span>
                        <input
                          type="text"
                          disabled={busy}
                          aria-label={`${o.itemName} 새 옵션 이름`}
                          className="min-w-0 flex-1 rounded border border-gray-300 px-2 py-1 text-sm text-gray-900 disabled:bg-gray-100"
                          value={row.masterOptionName}
                          onChange={(e) => patchRow(key, { masterOptionName: e.target.value })}
                        />
                      </div>
                      <p className="mt-1 text-[11px] text-gray-500">
                        {row.masterOptionName.trim() === ''
                          ? '새 옵션 이름을 입력하세요'
                          : '이 수량과 같은 옵션이 마스터에 없어 새 옵션을 만듭니다.'}
                      </p>
                    </>
                  )}

                  <p className="mt-2 text-xs text-gray-500">구성</p>
                  <ul className="mt-1 space-y-1">
                    {preview.components.map((c) => {
                      const value = row.quantities[c.productId] ?? '';
                      return (
                        <li key={c.productId} className="flex items-center gap-2">
                          <span className="min-w-0 flex-1 truncate text-sm text-gray-900">
                            {c.brand ? `${c.brand} ` : ''}
                            {c.productName}
                          </span>
                          <QuantityStepper
                            className="w-24 shrink-0"
                            disabled={busy}
                            ariaLabel={`${c.productName} 수량`}
                            value={value}
                            onChange={(next) => {
                              const quantities = { ...row.quantities, [c.productId]: next };
                              patchRow(key, {
                                quantities,
                                // D31: 수량이 바뀌면 고른 옵션도 그 수량을 따라간다.
                                masterOptionId:
                                  matchMasterOption(componentIds, quantities, masterOptions)?.id ??
                                  'new',
                              });
                            }}
                          />
                        </li>
                      );
                    })}
                  </ul>
                </li>
              );
            })}
          </ul>

          <p className="shrink-0 text-[11px] text-gray-500">
            마스터 옵션을 고르면 수량이 그 옵션 값으로 채워지고, 수량을 바꾸면 같은 수량의 옵션이 골라집니다.
            <br />
            같은 수량의 옵션이 없으면 새 옵션이 만들어집니다.
          </p>
        </>
      )}

      <div className="mt-4 flex shrink-0 flex-col items-end gap-1">
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="rounded border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-100 disabled:opacity-50"
          >
            취소
          </button>
          {preview && (
            <Button
              type="button"
              onClick={handleImport}
              disabled={!canImport}
              size="sm"
              className="flex items-center gap-1"
            >
              {busy ? <Spinner label="가져오는 중…" /> : '가져오기'}
            </Button>
          )}
        </div>
        {/* 비활성 사유를 숨기지 않는다 — 왜 못 누르는지 보여준다. */}
        {preview && !busy && nameMissing && (
          <p className="text-[11px] text-gray-500">새 옵션 이름을 모두 입력하세요</p>
        )}
        {preview && !busy && !nameMissing && quantityInvalid && (
          <p className="text-[11px] text-gray-500">수량은 1 이상의 정수여야 합니다</p>
        )}
      </div>
    </Modal>
  );
}
