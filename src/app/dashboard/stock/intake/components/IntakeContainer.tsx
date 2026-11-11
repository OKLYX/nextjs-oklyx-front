'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { PageContainer } from '@/presentation/components/PageContainer';
import { Button } from '@/presentation/components/ui/Button';
import { ProductPicker } from '@/presentation/components/ProductPicker';
import { StockLotUseCase } from '@/application/usecases/StockLotUseCase';
import { StockLotRepositoryImpl } from '@/infrastructure/repositories/StockLotRepositoryImpl';
import { CreateProductUseCase } from '@/application/usecases/CreateProductUseCase';
import { UpdateProductUseCase } from '@/application/usecases/UpdateProductUseCase';
import { ProductRepositoryImpl } from '@/infrastructure/repositories/ProductRepositoryImpl';
import { SellerUseCase } from '@/application/usecases/SellerUseCase';
import { SellerRepositoryImpl } from '@/infrastructure/repositories/SellerRepositoryImpl';
import type { Seller } from '@/domain/entities/SellerEntity';
import type { IntakeReason } from '@/application/dto/StockLotDTOs';
import { toast } from '@/infrastructure/stores/toastStore';
import { openFillFlow } from '@/infrastructure/stores/fillFlowStore';
import { extractErrorMessage } from '@/infrastructure/utils/errorMessage';
import { ScanInput } from '../../packing/components/ScanInput';
import { StockProductThumb } from '@/app/dashboard/stock/components/StockProductThumb';

/**
 * 「재고관리 > 입고 작업」 (FEATURE_2610_19 D113 · D117).
 *
 * - The barcode is read like the packing console: page-wide keys (scanner or keyboard), Enter confirms, no input box
 *   of its own (D117 ② · `ScanInput`).
 * - 「판매자」 (「미정」 + sellers) and 「사유」 (「매입」 · 「기초재고」) sit next to the day (FEATURE_2611_01 D1 · D16). A found
 *   product goes into the list with 1 and those two values; the same barcode again adds 1 to the top line of that
 *   product with the same seller and reason, else a new line (D17 · D23). The quantity can be changed or the line
 *   removed (D117 ③).
 * - Each line may take its own seller and reason — that line is then 「따로 정함」 and no longer follows the screen
 *   values; every other line follows them when they change (D18 · D21). 「미정」 + 「기초재고」 cannot be picked, on the
 *   screen or on a line (D22). One seller = that seller, fixed, only the reason is picked (D20).
 * - Not found: 「등록 안 된 바코드」 + a product search — save this barcode (and the name / registered price) on the
 *   picked product, or [새 상품으로 등록] with this barcode (D117 ④). A barcode another product owns is refused with
 *   that product's name (D117 ⑤ — the server message).
 * - [입고 저장] saves every line at once: the day (today, changeable), each line's seller and reason, amount from the
 *   registered price (D117 ⑥ · D135). An 「기초재고」 line without a seller stops the whole save (D19).
 */

interface CartLine {
  /** Line key — the same product can sit on several lines (FEATURE_2611_01 D17). */
  key: number;
  productId: number;
  productName: string;
  /** The product's representative photo as stored; null = none (FEATURE_2611_02 D15). */
  imageUrl: string | null;
  quantity: string;
  /** '' = 「미정」. */
  sellerId: string;
  reason: IntakeReason;
  /** 「따로 정함」 — set on the line itself, no longer follows the screen values (D21). */
  custom: boolean;
}

// Local calendar day (YYYY-MM-DD) — toISOString (UTC) can be a day off in KST.
const today = () => {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
};

const INPUT_CLASS =
  'px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500';

/** 「미정」 + 「기초재고」 is never a pair (FEATURE_2611_01 D22) — the option label tells what to pick first. */
const OPENING_NEEDS_SELLER = '기초재고 (먼저 판매자를 고르세요)';

export function IntakeContainer() {
  const lotUseCase = useMemo(() => new StockLotUseCase(new StockLotRepositoryImpl()), []);
  const createUseCase = useMemo(() => new CreateProductUseCase(new ProductRepositoryImpl()), []);
  const updateUseCase = useMemo(() => new UpdateProductUseCase(new ProductRepositoryImpl()), []);
  const sellerUseCase = useMemo(() => new SellerUseCase(new SellerRepositoryImpl()), []);

  const [buffer, setBuffer] = useState('');
  const [isScanning, setIsScanning] = useState(false);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [movedOn, setMovedOn] = useState(today());
  const [unknownBarcode, setUnknownBarcode] = useState<string | null>(null);
  const [picked, setPicked] = useState<{ id: number; name: string } | null>(null);
  const [editName, setEditName] = useState('');
  const [editPrice, setEditPrice] = useState('');
  const [newName, setNewName] = useState('');
  const [newPrice, setNewPrice] = useState('');
  const [message, setMessage] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [sellers, setSellers] = useState<Seller[]>([]);
  const [screenSellerId, setScreenSellerId] = useState('');
  const [screenReason, setScreenReason] = useState<IntakeReason>('PURCHASE');
  const nextKey = useRef(1);

  // D20: one seller = that seller, fixed (no 「미정」) — also for a line scanned before the seller list arrived.
  const soleSeller = sellers.length === 1 ? sellers[0] : null;
  const lineSeller = (line: CartLine) => (soleSeller ? String(soleSeller.id) : line.sellerId);

  useEffect(() => {
    void sellerUseCase
      .getAll()
      .then((list) => {
        setSellers(list);
        if (list.length === 1) setScreenSellerId(String(list[0].id));
      })
      .catch(() => setSellers([]));
  }, [sellerUseCase]);

  // D17 · D23: +1 on the top line of that product with the screen seller and reason, else a new line with them.
  // FEATURE_2611_02 D15: a new line keeps the photo of the value it came from.
  const addToCart = useCallback(
    (productId: number, productName: string, imageUrl: string | null) => {
      setCart((prev) => {
        const found = prev.find(
          (line) => line.productId === productId && line.sellerId === screenSellerId && line.reason === screenReason
        );
        if (found) {
          return prev.map((line) =>
            line.key === found.key ? { ...line, quantity: String(Number(line.quantity || '0') + 1) } : line
          );
        }
        const key = nextKey.current++;
        return [
          ...prev,
          {
            key,
            productId,
            productName,
            imageUrl,
            quantity: '1',
            sellerId: screenSellerId,
            reason: screenReason,
            custom: false,
          },
        ];
      });
    },
    [screenSellerId, screenReason]
  );

  // D18: the lines not set on their own follow the screen values.
  const changeScreen = (sellerId: string, reason: IntakeReason) => {
    setScreenSellerId(sellerId);
    setScreenReason(reason);
    setCart((prev) => prev.map((line) => (line.custom ? line : { ...line, sellerId, reason })));
  };

  // D21: a line changed on its own stops following the screen values.
  const changeLine = (key: number, patch: Partial<Pick<CartLine, 'sellerId' | 'reason'>>) =>
    setCart((prev) => prev.map((line) => (line.key === key ? { ...line, ...patch, custom: true } : line)));

  const lookup = useCallback(
    async (code: string) => {
      const value = code.trim();
      if (!value) return;
      setIsScanning(true);
      setMessage('');
      try {
        const result = await lotUseCase.barcode(value);
        if (result.found && result.productId !== null) {
          addToCart(result.productId, result.productName ?? '', result.imageUrl);
          setUnknownBarcode(null);
        } else {
          setUnknownBarcode(value);
          setPicked(null);
          setEditName('');
          setEditPrice('');
          setNewName('');
          setNewPrice('');
        }
      } catch (err) {
        setMessage(extractErrorMessage(err, '바코드를 찾지 못했습니다.'));
      } finally {
        setIsScanning(false);
      }
    },
    [lotUseCase, addToCart]
  );

  // Page-wide key capture (same rule as the packing console): a focused input keeps its keys.
  const handlersRef = useRef({ lookup, buffer, busy: false });
  useEffect(() => {
    handlersRef.current = { lookup, buffer, busy: isScanning || isSaving };
  });
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const tag = (event.target as HTMLElement | null)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      const handlers = handlersRef.current;
      if (handlers.busy) return;
      if (event.key === 'Enter') {
        event.preventDefault();
        const code = handlers.buffer;
        setBuffer('');
        void handlers.lookup(code);
        return;
      }
      if (event.key === 'Backspace') {
        event.preventDefault();
        setBuffer((prev) => prev.slice(0, -1));
        return;
      }
      if (event.key.length === 1) {
        event.preventDefault();
        setBuffer((prev) => prev + event.key);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const saveBarcodeOnPicked = async () => {
    if (!picked || unknownBarcode === null) return;
    const price = editPrice.trim() === '' ? undefined : Number(editPrice);
    setMessage('');
    try {
      const saved = await updateUseCase.updateProduct(picked.id, {
        barcodeId: unknownBarcode,
        ...(editName.trim() !== '' ? { productName: editName.trim() } : {}),
        ...(price !== undefined ? { price } : {}),
      });
      addToCart(saved.id, saved.productName, saved.imageUrl ?? null);
      setUnknownBarcode(null);
    } catch (err) {
      setMessage(extractErrorMessage(err, '상품에 바코드를 저장하지 못했습니다.'));
    }
  };

  const createWithBarcode = async () => {
    if (unknownBarcode === null) return;
    if (newName.trim() === '') {
      setMessage('상품 이름을 입력하세요.');
      return;
    }
    const price = newPrice.trim() === '' ? undefined : Number(newPrice);
    setMessage('');
    try {
      const created = await createUseCase.createProduct({
        productName: newName.trim(),
        barcodeId: unknownBarcode,
        ...(price !== undefined ? { price } : {}),
      });
      addToCart(created.id, created.productName, created.imageUrl ?? null);
      setUnknownBarcode(null);
    } catch (err) {
      setMessage(extractErrorMessage(err, '새 상품을 등록하지 못했습니다.'));
    }
  };

  const save = async () => {
    const invalid = cart.find((line) => !Number.isInteger(Number(line.quantity)) || Number(line.quantity) < 1);
    if (invalid) {
      setMessage('수량은 1 이상 정수만 입력할 수 있습니다.');
      return;
    }
    // D19: the last safety net — the selects already keep 「미정」 + 「기초재고」 apart (D22).
    const openingWithoutSeller = cart.filter((line) => line.reason === 'OPENING' && lineSeller(line) === '');
    if (openingWithoutSeller.length > 0) {
      setMessage(
        `기초재고는 판매자를 골라야 합니다: ${openingWithoutSeller.map((line) => line.productName).join(', ')}`
      );
      return;
    }
    setIsSaving(true);
    setMessage('');
    try {
      const lotIds = await lotUseCase.intake({
        movedOn,
        lines: cart.map((line) => ({
          productId: line.productId,
          quantity: Number(line.quantity),
          ...(lineSeller(line) !== '' ? { sellerId: Number(lineSeller(line)) } : {}),
          reason: line.reason,
        })),
      });
      toast.success('입고를 저장했습니다.');
      setCart([]);
      openFillFlow(lotIds);                          // FEATURE_2611_22 D3 ① · D31
    } catch (err) {
      setMessage(extractErrorMessage(err, '입고를 저장하지 못했습니다.'));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <PageContainer title="입고 작업">
      <ScanInput mode="ITEM" buffer={buffer} disabled={isSaving} isScanning={isScanning} />

      {message && (
        <div className="p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">{message}</div>
      )}

      {unknownBarcode !== null && (
        <div className="bg-white rounded-lg shadow p-4 space-y-3">
          <p className="text-sm font-medium text-amber-800">등록 안 된 바코드: {unknownBarcode}</p>
          <div className="space-y-2">
            <p className="text-sm text-gray-700">있는 상품에 이 바코드 넣기</p>
            <ProductPicker
              productId={picked?.id ?? null}
              productName={picked?.name ?? ''}
              onSelect={(id, name) => {
                setPicked({ id, name });
                setEditName(name);
              }}
              onClear={() => setPicked(null)}
            />
            {picked && (
              <div className="flex flex-wrap items-end gap-2">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">상품 이름</label>
                  <input value={editName} onChange={(e) => setEditName(e.target.value)} className={INPUT_CLASS} />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">등록가 (비우면 그대로)</label>
                  <input
                    value={editPrice}
                    inputMode="decimal"
                    onChange={(e) => setEditPrice(e.target.value)}
                    className={INPUT_CLASS}
                  />
                </div>
                <Button size="sm" onClick={() => void saveBarcodeOnPicked()}>
                  이 상품에 바코드 저장
                </Button>
              </div>
            )}
          </div>
          <div className="border-t border-gray-200 pt-3 flex flex-wrap items-end gap-2">
            <div>
              <label className="block text-xs text-gray-500 mb-1">새 상품 이름</label>
              <input value={newName} onChange={(e) => setNewName(e.target.value)} className={INPUT_CLASS} />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">등록가</label>
              <input
                value={newPrice}
                inputMode="decimal"
                onChange={(e) => setNewPrice(e.target.value)}
                className={INPUT_CLASS}
              />
            </div>
            <Button size="sm" variant="secondary" onClick={() => void createWithBarcode()}>
              새 상품으로 등록
            </Button>
          </div>
        </div>
      )}

      <div className="bg-white rounded-lg shadow p-4 space-y-3">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-gray-500">
              <th className="py-2">상품</th>
              <th className="py-2 w-40">판매자</th>
              <th className="py-2 w-56">사유</th>
              <th className="py-2 w-32">수량</th>
              <th className="py-2 w-20" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {cart.length === 0 && (
              <tr>
                <td colSpan={5} className="py-6 text-center text-gray-500">
                  바코드를 스캔하면 여기에 담깁니다.
                </td>
              </tr>
            )}
            {cart.map((line) => (
              <tr key={line.key}>
                <td className="py-2 text-gray-900">
                  <div className="flex items-center gap-2">
                    <StockProductThumb imageUrl={line.imageUrl} productId={line.productId} alt={line.productName} />
                    <span>
                      {line.productName}
                      {line.custom && <span className="ml-2 text-xs text-amber-700">따로 정함</span>}
                    </span>
                  </div>
                </td>
                <td className="py-2">
                  {soleSeller ? (
                    <span className="text-gray-700">{soleSeller.sellerName}</span>
                  ) : (
                    <select
                      value={line.sellerId}
                      onChange={(e) => changeLine(line.key, { sellerId: e.target.value })}
                      className={INPUT_CLASS}
                    >
                      <option value="" disabled={line.reason === 'OPENING'}>
                        미정
                      </option>
                      {sellers.map((seller) => (
                        <option key={seller.id} value={seller.id}>
                          {seller.sellerName}
                        </option>
                      ))}
                    </select>
                  )}
                </td>
                <td className="py-2">
                  <select
                    value={line.reason}
                    onChange={(e) => changeLine(line.key, { reason: e.target.value as IntakeReason })}
                    className={INPUT_CLASS}
                  >
                    <option value="PURCHASE">매입</option>
                    <option value="OPENING" disabled={lineSeller(line) === ''}>
                      {lineSeller(line) === '' ? OPENING_NEEDS_SELLER : '기초재고'}
                    </option>
                  </select>
                </td>
                <td className="py-2">
                  <input
                    type="number"
                    min={1}
                    value={line.quantity}
                    onChange={(e) =>
                      setCart((prev) => prev.map((l) => (l.key === line.key ? { ...l, quantity: e.target.value } : l)))
                    }
                    className={`${INPUT_CLASS} w-24`}
                  />
                </td>
                <td className="py-2 text-right">
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => setCart((prev) => prev.filter((l) => l.key !== line.key))}
                  >
                    빼기
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="flex flex-wrap items-end justify-end gap-2">
          <div>
            <label className="block text-xs text-gray-500 mb-1">입고일</label>
            <input type="date" value={movedOn} onChange={(e) => setMovedOn(e.target.value)} className={INPUT_CLASS} />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">판매자</label>
            {soleSeller ? (
              <p className="py-1 text-sm text-gray-700">{soleSeller.sellerName}</p>
            ) : (
              <select
                value={screenSellerId}
                onChange={(e) => changeScreen(e.target.value, screenReason)}
                className={INPUT_CLASS}
              >
                <option value="" disabled={screenReason === 'OPENING'}>
                  미정
                </option>
                {sellers.map((seller) => (
                  <option key={seller.id} value={seller.id}>
                    {seller.sellerName}
                  </option>
                ))}
              </select>
            )}
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">사유</label>
            <select
              value={screenReason}
              onChange={(e) => changeScreen(screenSellerId, e.target.value as IntakeReason)}
              className={INPUT_CLASS}
            >
              <option value="PURCHASE">매입</option>
              <option value="OPENING" disabled={screenSellerId === ''}>
                {screenSellerId === '' ? OPENING_NEEDS_SELLER : '기초재고'}
              </option>
            </select>
          </div>
          <Button onClick={() => void save()} disabled={cart.length === 0} isLoading={isSaving} loadingText="저장 중...">
            입고 저장
          </Button>
        </div>
      </div>
    </PageContainer>
  );
}
