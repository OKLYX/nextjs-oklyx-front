'use client';

import { useMemo, useState } from 'react';
import { Spinner } from '@/presentation/components/Spinner';
import { ListingRegistrationUseCase } from '@/application/usecases/ListingRegistrationUseCase';
import { ListingRegistrationRepositoryImpl } from '@/infrastructure/repositories/ListingRegistrationRepositoryImpl';
import { extractErrorMessage } from '@/infrastructure/utils/errorMessage';
import type { ImportPreviewResponse } from '@/domain/entities/ListingRegistrationEntity';

interface ImportCoupangProductModalProps {
  masterId: number;
  sellerId: number;
  platform: string;
  sellerName: string;
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
 * 백엔드 메시지를 가공하지 않고 그대로 쓰되, 사용자가 조치할 수 있는 3가지만 한 줄을 덧붙인다.
 * 판정은 HTTP status + 메시지 substring 으로만 한다 — 프론트에는 예외 클래스명이 오지 않는다.
 * ⚠️ 중복 채널만 409 다(그 외 가드는 400).
 */
const importErrorMessage = (e: unknown): string => {
  const status = (e as { response?: { status?: number } })?.response?.status;
  const message = extractErrorMessage(e, '가져오기에 실패했습니다.');
  if (status === 429) return '잠시 후 다시 시도하세요.';
  if (status === 409 && message.includes('이미 등록된 채널')) {
    return `${message} 이미 이 판매자·플랫폼 셀이 있습니다. 기존 셀을 지우거나 다른 마스터를 선택하세요.`;
  }
  if (status === 400 && message.includes('이미 다른 상품에 연결된')) {
    return `${message} 이 쿠팡 상품은 다른 마스터에 이미 연결돼 있습니다.`;
  }
  if ((status === 400 || status === 404) && message.includes('계정')) {
    return `${message} 판매자 관리에서 쿠팡 계정을 먼저 등록·활성화하세요.`;
  }
  return message;
};

/** 옵션 식별 키. 미승인 옵션은 vendorItemId 가 없어 itemName 으로 대신한다(서버 매칭 규칙과 동일). */
const optionKey = (o: ImportPreviewResponse['options'][number]) => o.vendorItemId ?? o.itemName;

interface OptionDraft {
  masterOptionName: string;
  /** productId → 입력 문자열. 숫자 변환은 제출 직전에 한 번만(입력 중 변환은 지우는 순간 값이 튄다). */
  quantities: Record<number, string>;
}

const isPositiveInt = (raw: string) => {
  const v = Number(raw);
  return raw.trim() !== '' && Number.isInteger(v) && v >= 1;
};

/**
 * 쿠팡 상품 가져오기 모달 (2609_22).
 * File: src/app/dashboard/master-products/[id]/components/ImportCoupangProductModal.tsx
 *
 * 이미 쿠팡에 올라가 있는 상품을 이 마스터의 채널 셀로 편입한다. 2단계 — ① 상품 ID 로 조회
 * ② 옵션마다 구성 수량을 채워 [가져오기].
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
  onClose,
  onDone,
}: ImportCoupangProductModalProps) {
  const useCase = useMemo(
    () => new ListingRegistrationUseCase(new ListingRegistrationRepositoryImpl()),
    [],
  );

  const [productId, setProductId] = useState('');
  const [preview, setPreview] = useState<ImportPreviewResponse | null>(null);
  const [draft, setDraft] = useState<Record<string, OptionDraft>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

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
      setDraft(
        Object.fromEntries(
          res.options.map((o) => [
            optionKey(o),
            {
              masterOptionName: o.itemName,
              quantities: Object.fromEntries(res.components.map((c) => [c.productId, '1'])),
            },
          ]),
        ),
      );
    } catch (e: unknown) {
      setError(importErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const rowOf = (key: string): OptionDraft => draft[key] ?? { masterOptionName: '', quantities: {} };

  const patchRow = (key: string, patch: Partial<OptionDraft>) =>
    setDraft((prev) => ({ ...prev, [key]: { ...rowOf(key), ...patch } }));

  const nameMissing =
    preview != null && preview.options.some((o) => rowOf(optionKey(o)).masterOptionName.trim() === '');
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
          return {
            vendorItemId: o.vendorItemId,
            itemName: o.itemName,
            masterOptionName: row.masterOptionName.trim(),
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="flex max-h-[85vh] w-full max-w-2xl flex-col rounded-lg bg-white p-5 shadow-lg">
        <div className="mb-4 flex shrink-0 items-center justify-between">
          <div className="min-w-0">
            <h2 className="text-lg font-semibold text-gray-900">쿠팡 상품 가져오기</h2>
            <p className="truncate text-xs text-gray-500">
              {sellerName} · {platform}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="shrink-0 text-sm text-gray-500 hover:text-gray-800 disabled:opacity-50"
          >
            닫기
          </button>
        </div>

        <div className="mb-3 flex shrink-0 items-center gap-2">
          <label className="text-sm text-gray-700" htmlFor="coupang-product-id">
            쿠팡 상품 ID
          </label>
          <input
            id="coupang-product-id"
            type="text"
            inputMode="numeric"
            disabled={busy}
            className="w-48 rounded border border-gray-300 px-2 py-1 text-sm text-gray-900 disabled:bg-gray-100"
            value={productId}
            onChange={(e) => setProductId(e.target.value)}
          />
          <button
            type="button"
            onClick={handleLookup}
            disabled={productId.trim() === '' || busy}
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
                      <span className="shrink-0 text-xs text-gray-500">마스터 옵션명</span>
                      <input
                        type="text"
                        disabled={busy}
                        className="min-w-0 flex-1 rounded border border-gray-300 px-2 py-1 text-sm text-gray-900 disabled:bg-gray-100"
                        value={row.masterOptionName}
                        onChange={(e) => patchRow(key, { masterOptionName: e.target.value })}
                      />
                    </div>
                    {row.masterOptionName.trim() === '' && (
                      <p className="mt-1 text-[11px] text-gray-500">마스터 옵션명을 입력하세요</p>
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
                            <input
                              type="text"
                              inputMode="numeric"
                              disabled={busy}
                              className="w-20 shrink-0 rounded border border-gray-300 px-2 py-1 text-right text-sm text-gray-900 disabled:bg-gray-100"
                              value={value}
                              onChange={(e) =>
                                patchRow(key, {
                                  quantities: { ...row.quantities, [c.productId]: e.target.value },
                                })
                              }
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
              구성이 마스터의 기존 옵션과 같으면 그 옵션에 연결되고, 다르면 새 옵션이 만들어집니다.
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
              <button
                type="button"
                onClick={handleImport}
                disabled={!canImport}
                className="flex items-center gap-1 rounded bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {busy ? <Spinner label="가져오는 중…" /> : '가져오기'}
              </button>
            )}
          </div>
          {/* 비활성 사유를 숨기지 않는다 — 왜 못 누르는지 보여준다. */}
          {preview && !busy && nameMissing && (
            <p className="text-[11px] text-gray-500">마스터 옵션명을 모두 입력하세요</p>
          )}
          {preview && !busy && !nameMissing && quantityInvalid && (
            <p className="text-[11px] text-gray-500">수량은 1 이상의 정수여야 합니다</p>
          )}
        </div>
      </div>
    </div>
  );
}
