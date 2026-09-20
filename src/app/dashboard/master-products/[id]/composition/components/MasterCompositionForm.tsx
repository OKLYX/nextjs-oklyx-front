'use client';

import { useMemo, useState } from 'react';
import { Spinner } from '@/presentation/components/Spinner';
import { ConfirmDialog } from '@/presentation/components/ui/ConfirmDialog';
import { extractErrorMessage } from '@/infrastructure/utils/errorMessage';
import { getImageUrl } from '@/infrastructure/utils/imageUrl';
import type { MasterProductUseCase } from '@/application/usecases/MasterProductUseCase';
import type { MasterProductResponse } from '@/domain/entities/MasterProductEntity';
import type { Product } from '@/domain/entities/Product';

// 옵션 잠금 안내 문구 (85). 잠금 판정은 백엔드 플래그(marketRegistered) 하나만 쓴다.
// 🔴 `MasterOptionEditor` 의 같은 상수를 재수출하지 않고 문장만 맞춘다(PLAN/D10 — 그 파일은 건드리지 않는다).
const LOCKED_ROW_TITLE = '쿠팡에 등록돼 판매 중 — 이름 수정 및 삭제 불가 (구성 수량은 수정 가능)';
const LOCKED_DELETE_REASON = '쿠팡에 등록돼 판매 중 — 삭제할 수 없습니다.';

const PRODUCT_SEARCH_LIMIT = 50;

const formatWon = (v: number | null | undefined) =>
  v == null ? '—' : `${v.toLocaleString('ko-KR')}원`;

/**
 * 옵션 편집 버퍼 한 줄.
 * 기존 옵션은 `optionId` 를 갖고, 화면에서 추가한 옵션은 갖지 않는다(= 서버가 새로 만든다).
 */
type OptionDraft = {
  key: string; // React key (기존=`o{optionId}`, 신규=`n{seq}`)
  optionId?: number;
  name: string;
  locked: boolean; // master.options[].marketRegistered
  qty: Record<number, string>; // productId → 입력 문자열
};

interface MasterCompositionFormProps {
  master: MasterProductResponse;
  products: Product[];
  useCase: MasterProductUseCase;
  onSaved: () => void;
  onCancel: () => void;
}

/**
 * 구성상품 + 옵션 수량을 **한 번에** 저장하는 폼 (2609_64).
 * File: src/app/dashboard/master-products/[id]/composition/components/MasterCompositionForm.tsx
 *
 * 구성집합과 옵션의 수량 벡터는 서로를 검증하므로(집합 동등) 따로 저장하면 어느 쪽도 바꿀 수 없다.
 * 그래서 이 화면은 두 값을 버퍼에 모아 `PUT /{id}/composition` 한 번으로 보낸다.
 *
 * ⚠️ 옵션이 0개인 **편집 상태는 허용**한다(전부 지웠다 다시 채우는 것이 이 화면의 목적). 막는 것은 저장 버튼뿐이다.
 * ⚠️ 옵션의 배송·박스·카테고리 속성·고시·재고는 여기서 건드리지 않는다 — 상세의 [옵션 (수량조합)] 소관.
 */
export function MasterCompositionForm({
  master,
  products,
  useCase,
  onSaved,
  onCancel,
}: MasterCompositionFormProps) {
  const [selectedIds, setSelectedIds] = useState<number[]>(() =>
    master.components.map((c) => c.productId),
  );
  const [drafts, setDrafts] = useState<OptionDraft[]>(() =>
    master.options.map((o) => ({
      key: `o${o.id}`,
      optionId: o.id,
      name: o.name,
      locked: o.marketRegistered === true,
      qty: Object.fromEntries(o.items.map((it) => [it.productId, String(it.quantity)])),
    })),
  );
  const [newOptionSeq, setNewOptionSeq] = useState(0);

  const [productFilter, setProductFilter] = useState('');
  const [productQuery, setProductQuery] = useState('');
  const [productHasSearched, setProductHasSearched] = useState(false);

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');

  // 이름 표시용. 새로 고른 상품은 products 목록에, 원래 구성상품은 master.components 에 있다.
  const nameOf = useMemo(() => {
    const map = new Map<number, string>();
    master.components.forEach((c) => map.set(c.productId, c.productName));
    products.forEach((p) => map.set(p.id, p.productName));
    return (id: number) => map.get(id) ?? `#${id}`;
  }, [master.components, products]);

  const productById = useMemo(() => {
    const map = new Map<number, Product>();
    products.forEach((p) => map.set(p.id, p));
    return map;
  }, [products]);

  const filteredProducts = useMemo(() => {
    const q = productQuery.trim().toLowerCase();
    if (!q) return products;
    return products.filter((p) => (p.productName ?? '').toLowerCase().includes(q));
  }, [products, productQuery]);

  // 검색 결과 = 아직 고르지 않은 것만(이미 고른 것은 아래 격자 열로 보인다).
  const searchMatches = useMemo(() => {
    const selected = new Set(selectedIds);
    return filteredProducts.filter((p) => !selected.has(p.id));
  }, [filteredProducts, selectedIds]);
  const searchResults = searchMatches.slice(0, PRODUCT_SEARCH_LIMIT);

  // 요청에서 빠진 기존 옵션 = 저장 시 삭제된다. 되돌릴 수 있게 원본을 들고 있는다.
  const removedOptions = useMemo(
    () => master.options.filter((o) => !drafts.some((d) => d.optionId === o.id)),
    [master.options, drafts],
  );

  const handleProductSearch = () => {
    if (!productFilter.trim()) return;
    setProductQuery(productFilter);
    setProductHasSearched(true);
  };

  // 🔴 구성상품을 더하고 뺄 때 모든 draft 의 수량 벡터를 같이 손본다. 빠뜨리면 저장에서 백엔드 400
  // (`옵션은 구성상품 전체를 포함해야 합니다`)이 난다 — 옵션 벡터는 구성집합 전체를 덮어야 한다.
  const addComponent = (productId: number) => {
    setSelectedIds((prev) => (prev.includes(productId) ? prev : [...prev, productId]));
    setDrafts((prev) =>
      prev.map((d) =>
        d.qty[productId] === undefined ? { ...d, qty: { ...d.qty, [productId]: '1' } } : d,
      ),
    );
    setError('');
  };

  const removeComponent = (productId: number) => {
    setSelectedIds((prev) => prev.filter((x) => x !== productId));
    setDrafts((prev) =>
      prev.map((d) => {
        const qty = { ...d.qty };
        delete qty[productId];
        return { ...d, qty };
      }),
    );
    setError('');
  };

  const setDraftName = (key: string, name: string) =>
    setDrafts((prev) => prev.map((d) => (d.key === key ? { ...d, name } : d)));

  const setDraftQty = (key: string, productId: number, value: string) =>
    setDrafts((prev) =>
      prev.map((d) => (d.key === key ? { ...d, qty: { ...d.qty, [productId]: value } } : d)),
    );

  const removeDraft = (key: string) => setDrafts((prev) => prev.filter((d) => d.key !== key));

  const addDraft = () => {
    setDrafts((prev) => [
      ...prev,
      {
        key: `n${newOptionSeq}`,
        name: '',
        locked: false,
        qty: Object.fromEntries(selectedIds.map((pid) => [pid, '1'])),
      },
    ]);
    setNewOptionSeq((n) => n + 1);
  };

  // 삭제 표시된 기존 옵션 되살리기 — 수량은 **현재 구성상품 기준**으로 다시 짠다
  // (남아 있는 상품은 원래 수량, 새로 생긴 상품은 '1').
  const restoreOption = (optionId: number) => {
    const original = master.options.find((o) => o.id === optionId);
    if (!original) return;
    const originalQty = new Map(original.items.map((it) => [it.productId, it.quantity]));
    setDrafts((prev) => [
      ...prev,
      {
        key: `o${original.id}`,
        optionId: original.id,
        name: original.name,
        locked: original.marketRegistered === true,
        qty: Object.fromEntries(
          selectedIds.map((pid) => [pid, String(originalQty.get(pid) ?? 1)]),
        ),
      },
    ]);
  };

  const blockReason = useMemo(() => {
    if (selectedIds.length === 0) return '구성상품을 1개 이상 선택하세요.';
    if (drafts.length === 0) return '옵션을 1개 이상 남겨야 저장할 수 있습니다.';
    if (drafts.some((d) => d.name.trim() === '')) return '옵션 이름을 입력하세요.';
    if (drafts.some((d) => selectedIds.some((pid) => !(Number(d.qty[pid]) >= 1))))
      return '모든 수량은 1 이상이어야 합니다.';
    return '';
  }, [selectedIds, drafts]);
  const canSave = blockReason === '';

  const handleSave = async () => {
    setConfirmOpen(false);
    setIsSaving(true);
    setError('');
    try {
      await useCase.updateComposition(master.id, {
        componentProductIds: selectedIds,
        options: drafts.map((d) => ({
          optionId: d.optionId,
          name: d.name.trim(),
          items: selectedIds.map((pid) => ({ productId: pid, quantity: Number(d.qty[pid]) })),
        })),
      });
      onSaved();
    } catch (e: unknown) {
      // 백엔드 문구를 그대로 띄운다 — 잠긴 옵션·중복 구성집합·수량 불일치의 사유가 거기 있다.
      setError(extractErrorMessage(e, '저장에 실패했습니다.'));
      setIsSaving(false);
    }
  };

  const originalNames = master.components.map((c) => c.productName);
  const nextNames = selectedIds.map(nameOf);
  const deletedNames = removedOptions.map((o) => o.name);

  const renderThumb = (p: Product) => {
    const src = getImageUrl(p.imageUrl, p.id);
    return src ? (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt={p.productName}
        className="h-10 w-10 rounded border border-gray-200 object-cover"
      />
    ) : (
      <div className="flex h-10 w-10 items-center justify-center rounded border border-gray-200 bg-gray-100 text-[10px] text-gray-400">
        없음
      </div>
    );
  };

  return (
    <>
      {error && <p className="mb-4 rounded bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      <div className="space-y-6">
        {/* ── 구성상품 선택 ─────────────────────────────────────────────── */}
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-600">
            구성상품 ({selectedIds.length}개 선택)
          </label>
          <div className="mb-2 flex gap-2">
            <input
              className="flex-1 rounded border border-gray-300 px-2 py-1.5 text-sm text-gray-900"
              placeholder="상품명으로 검색"
              value={productFilter}
              onChange={(e) => setProductFilter(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleProductSearch();
                }
              }}
            />
            <button
              type="button"
              onClick={handleProductSearch}
              disabled={productFilter.trim() === ''}
              className="rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              검색
            </button>
          </div>

          {productHasSearched && (
            <div className="mb-2 max-h-40 overflow-y-auto rounded border border-gray-200">
              {searchResults.length === 0 ? (
                <p className="px-3 py-2 text-sm text-gray-500">검색 결과가 없습니다.</p>
              ) : (
                <ul className="divide-y divide-gray-100">
                  {searchResults.map((p) => (
                    <li key={p.id}>
                      <button
                        type="button"
                        onClick={() => addComponent(p.id)}
                        className="flex w-full items-center gap-2 px-3 py-1.5 text-left hover:bg-blue-50"
                      >
                        {renderThumb(p)}
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm text-gray-800">
                            {p.productName}
                          </span>
                          <span className="block truncate text-[11px] text-gray-400">
                            {p.brand || '—'} · {formatWon(p.price)}
                          </span>
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              {searchMatches.length > searchResults.length && (
                <p className="border-t border-gray-100 px-3 py-1.5 text-[11px] text-gray-400">
                  {searchMatches.length}개 중 {searchResults.length}개 표시 — 더 구체적으로 검색하세요.
                </p>
              )}
            </div>
          )}

          <p className="mb-2 text-[11px] text-gray-500">
            검색 결과에서 선택하면 아래 목록에 추가됩니다. 추가·제거하면 모든 옵션의 수량 칸이 함께
            바뀝니다.
          </p>

          <div className="max-h-64 overflow-y-auto rounded border border-gray-200">
            <table className="w-full text-sm">
              <thead className="sticky top-0 border-b border-gray-200 bg-gray-100 text-xs text-gray-500">
                <tr>
                  <th className="px-2 py-1.5 text-left font-medium">이미지</th>
                  <th className="px-2 py-1.5 text-left font-medium">제품명</th>
                  <th className="px-2 py-1.5 text-left font-medium">브랜드</th>
                  <th className="px-2 py-1.5 text-right font-medium">가격</th>
                  <th className="w-10 px-2 py-1.5"></th>
                </tr>
              </thead>
              <tbody>
                {selectedIds.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-3 py-2 text-sm text-gray-500">
                      선택된 상품이 없습니다.
                    </td>
                  </tr>
                ) : (
                  selectedIds.map((pid) => {
                    const p = productById.get(pid);
                    return (
                      <tr key={pid} className="border-t border-gray-100">
                        <td className="px-2 py-1.5">
                          {p ? (
                            renderThumb(p)
                          ) : (
                            <div className="h-10 w-10 rounded border border-gray-200 bg-gray-100" />
                          )}
                        </td>
                        <td className="px-2 py-1.5 text-gray-900">{nameOf(pid)}</td>
                        <td className="px-2 py-1.5 text-gray-600">{p?.brand || '—'}</td>
                        <td className="px-2 py-1.5 text-right text-gray-900">
                          {formatWon(p?.price)}
                        </td>
                        <td className="px-2 py-1.5 text-right">
                          <button
                            type="button"
                            onClick={() => removeComponent(pid)}
                            className="rounded px-1.5 py-0.5 text-xs font-medium text-red-600 hover:bg-red-50"
                            aria-label="구성상품 제거"
                          >
                            ✕
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* ── 옵션 × 구성상품 수량 격자 ──────────────────────────────────── */}
        <div>
          <h3 className="mb-1 text-sm font-semibold text-gray-900">
            옵션 × 구성상품 수량 ({drafts.length}개 옵션)
          </h3>
          <p className="mb-2 text-[11px] text-gray-500">
            쿠팡에 등록돼 판매 중인 옵션은 이름 수정·삭제가 막혀 있고, 구성 수량은 수정할 수 있습니다.
          </p>

          <div className="overflow-x-auto rounded border border-gray-200">
            <table className="w-full text-sm">
              <thead className="border-b border-gray-200 bg-gray-100 text-xs text-gray-500">
                <tr>
                  <th className="px-2 py-1.5 text-left font-medium">옵션명</th>
                  {selectedIds.map((pid) => (
                    <th key={pid} className="px-2 py-1.5 text-left font-medium">
                      {nameOf(pid)}
                    </th>
                  ))}
                  <th className="w-12 px-2 py-1.5"></th>
                </tr>
              </thead>
              <tbody>
                {drafts.length === 0 ? (
                  <tr>
                    <td
                      colSpan={selectedIds.length + 2}
                      className="px-3 py-2 text-sm text-gray-500"
                    >
                      옵션이 없습니다. [옵션 추가]로 만드세요.
                    </td>
                  </tr>
                ) : (
                  drafts.map((d) => (
                    <tr key={d.key} className="border-t border-gray-100">
                      <td className="px-2 py-1.5">
                        <input
                          className="w-40 rounded border border-gray-300 px-2 py-1 text-sm text-gray-900 read-only:bg-gray-100 read-only:text-gray-500"
                          value={d.name}
                          readOnly={d.locked}
                          title={d.locked ? LOCKED_ROW_TITLE : undefined}
                          placeholder="옵션명"
                          onChange={(e) => setDraftName(d.key, e.target.value)}
                        />
                      </td>
                      {selectedIds.map((pid) => (
                        <td key={pid} className="px-2 py-1.5">
                          {/* 잠긴 옵션도 수량은 편집 가능하다 — 수량은 우리 원장이지 마켓 소유가 아니다. */}
                          <input
                            type="number"
                            min={1}
                            className="w-20 rounded border border-gray-300 px-2 py-1 text-sm text-gray-900"
                            value={d.qty[pid] ?? ''}
                            onChange={(e) => setDraftQty(d.key, pid, e.target.value)}
                          />
                        </td>
                      ))}
                      <td className="px-2 py-1.5 text-right">
                        <button
                          type="button"
                          onClick={() => removeDraft(d.key)}
                          disabled={d.locked}
                          title={d.locked ? LOCKED_DELETE_REASON : undefined}
                          className="rounded px-1.5 py-0.5 text-xs font-medium text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40"
                          aria-label="옵션 제거"
                        >
                          ✕
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="mt-2 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={addDraft}
              className="rounded border border-gray-300 px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-100"
            >
              옵션 추가
            </button>
            <span className="text-[11px] text-gray-500">
              여기서 추가한 옵션은 이름과 수량만 갖습니다. 배송·박스·카테고리 속성·고시·재고는 저장 후
              상세의 [옵션 (수량조합)]에서 채우세요.
            </span>
          </div>

          {removedOptions.length > 0 && (
            <div className="mt-3 rounded border border-gray-200 bg-gray-50 px-3 py-2">
              <p className="text-xs text-gray-600">
                삭제될 옵션:{' '}
                {removedOptions.map((o, i) => (
                  <span key={o.id}>
                    {i > 0 && ' · '}
                    <span className="font-medium text-gray-800">{o.name}</span>
                  </span>
                ))}{' '}
                — 저장하면 채널에서 꺼지고(행·기록은 유지) 마스터에서 사라집니다.
              </p>
              <div className="mt-1 flex flex-wrap gap-2">
                {removedOptions.map((o) => (
                  <button
                    key={o.id}
                    type="button"
                    onClick={() => restoreOption(o.id)}
                    className="rounded border border-gray-300 bg-white px-2 py-0.5 text-[11px] font-medium text-gray-700 hover:bg-gray-100"
                  >
                    {o.name} 되돌리기
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ── 저장 ──────────────────────────────────────────────────────── */}
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setConfirmOpen(true)}
              disabled={!canSave || isSaving}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {isSaving ? <Spinner label="저장 중…" /> : '저장'}
            </button>
            <button
              type="button"
              onClick={onCancel}
              disabled={isSaving}
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 disabled:opacity-50"
            >
              취소
            </button>
          </div>
          {!canSave && <p className="mt-1 text-xs text-amber-700">{blockReason}</p>}
          {isSaving && (
            <p className="mt-1 text-xs text-gray-500">
              연결된 판매상품의 구성·원가·판매가와 상세·썸네일을 다시 만드는 중입니다. 채널이 많으면
              몇 초 걸립니다.
            </p>
          )}
        </div>
      </div>

      <ConfirmDialog
        isOpen={confirmOpen}
        title="구성상품 변경"
        confirmText="저장"
        isLoading={isSaving}
        onConfirm={() => void handleSave()}
        onCancel={() => setConfirmOpen(false)}
        message={
          <div className="space-y-2 text-sm">
            <p>
              구성상품이 <span className="font-medium">{originalNames.join(', ') || '없음'}</span> →{' '}
              <span className="font-medium">{nextNames.join(', ') || '없음'}</span> 로 바뀝니다.
            </p>
            <p>
              옵션 {drafts.length}개의 구성 수량이 함께 저장됩니다.
              {deletedNames.length > 0 && (
                <>
                  {' '}
                  옵션 <span className="font-medium">{deletedNames.join(', ')}</span> 가 삭제됩니다 —
                  채널에서는 꺼지고 기록은 남습니다.
                </>
              )}
            </p>
            <p>
              이 마스터에 연결된 판매상품의 구성·원가·판매가가 다시 계산됩니다.{' '}
              <span className="font-medium">쿠팡에는 자동으로 전송되지 않습니다</span> — 필요하면
              상세에서 [수정 요청]을 누르세요.
            </p>
          </div>
        }
      />
    </>
  );
}
