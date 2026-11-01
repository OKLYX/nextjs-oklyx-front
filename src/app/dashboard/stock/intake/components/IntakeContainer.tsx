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
import { toast } from '@/infrastructure/stores/toastStore';
import { extractErrorMessage } from '@/infrastructure/utils/errorMessage';
import { ScanInput } from '../../packing/components/ScanInput';

/**
 * 「재고관리 > 입고 작업」 (FEATURE_2610_19 D113 · D117).
 *
 * - The barcode is read like the packing console: page-wide keys (scanner or keyboard), Enter confirms, no input box
 *   of its own (D117 ② · `ScanInput`).
 * - A found product goes into the list with 1; the same barcode again adds 1. The quantity can be changed or the
 *   line removed (D117 ③).
 * - Not found: 「등록 안 된 바코드」 + a product search — save this barcode (and the name / registered price) on the
 *   picked product, or [새 상품으로 등록] with this barcode (D117 ④). A barcode another product owns is refused with
 *   that product's name (D117 ⑤ — the server message).
 * - [입고 저장] saves every line at once: the day (today, changeable), seller undecided, amount from the registered
 *   price (D117 ⑥ · D135).
 */

interface CartLine {
  productId: number;
  productName: string;
  quantity: string;
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

export function IntakeContainer() {
  const lotUseCase = useMemo(() => new StockLotUseCase(new StockLotRepositoryImpl()), []);
  const createUseCase = useMemo(() => new CreateProductUseCase(new ProductRepositoryImpl()), []);
  const updateUseCase = useMemo(() => new UpdateProductUseCase(new ProductRepositoryImpl()), []);

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

  const addToCart = useCallback((productId: number, productName: string) => {
    setCart((prev) => {
      const found = prev.find((line) => line.productId === productId);
      if (found) {
        return prev.map((line) =>
          line.productId === productId ? { ...line, quantity: String(Number(line.quantity || '0') + 1) } : line
        );
      }
      return [...prev, { productId, productName, quantity: '1' }];
    });
  }, []);

  const lookup = useCallback(
    async (code: string) => {
      const value = code.trim();
      if (!value) return;
      setIsScanning(true);
      setMessage('');
      try {
        const result = await lotUseCase.barcode(value);
        if (result.found && result.productId !== null) {
          addToCart(result.productId, result.productName ?? '');
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
      addToCart(saved.id, saved.productName);
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
      addToCart(created.id, created.productName);
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
    setIsSaving(true);
    setMessage('');
    try {
      await lotUseCase.intake({
        movedOn,
        lines: cart.map((line) => ({ productId: line.productId, quantity: Number(line.quantity) })),
      });
      toast.success('입고를 저장했습니다.');
      setCart([]);
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
              <th className="py-2 w-32">수량</th>
              <th className="py-2 w-20" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {cart.length === 0 && (
              <tr>
                <td colSpan={3} className="py-6 text-center text-gray-500">
                  바코드를 스캔하면 여기에 담깁니다.
                </td>
              </tr>
            )}
            {cart.map((line) => (
              <tr key={line.productId}>
                <td className="py-2 text-gray-900">{line.productName}</td>
                <td className="py-2">
                  <input
                    type="number"
                    min={1}
                    value={line.quantity}
                    onChange={(e) =>
                      setCart((prev) =>
                        prev.map((l) => (l.productId === line.productId ? { ...l, quantity: e.target.value } : l))
                      )
                    }
                    className={`${INPUT_CLASS} w-24`}
                  />
                </td>
                <td className="py-2 text-right">
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => setCart((prev) => prev.filter((l) => l.productId !== line.productId))}
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
          <Button onClick={() => void save()} disabled={cart.length === 0} isLoading={isSaving} loadingText="저장 중...">
            입고 저장
          </Button>
        </div>
      </div>
    </PageContainer>
  );
}
