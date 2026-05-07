'use client';

import { useMemo, useState } from 'react';
import { StockRepositoryImpl } from '@/infrastructure/repositories/StockRepositoryImpl';
import { StockUseCase } from '@/application/usecases/StockUseCase';
import type { GetStockLogsResponse } from '@/domain/repositories/StockRepository';
import { StockSearchForm } from './StockSearchForm';
import { StockSearchTable } from './StockSearchTable';

export function StockSearchContainer() {
  const [barcodeId, setBarcodeId] = useState('');
  const [productName, setProductName] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [logs, setLogs] = useState<GetStockLogsResponse | null>(null);
  const [currentPage, setCurrentPage] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [hasSearched, setHasSearched] = useState(false);

  const stockUseCase = useMemo(() => {
    const repository = new StockRepositoryImpl();
    return new StockUseCase(repository);
  }, []);

  const handleSearch = async () => {
    setError('');
    setIsLoading(true);
    setCurrentPage(0);
    setHasSearched(true);

    try {
      const response = await stockUseCase.getStockLogs({
        barcodeId: barcodeId || undefined,
        productName: productName || undefined,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        page: 0,
        size: 20,
      });
      setLogs(response);
    } catch {
      setError('재고 이력을 조회할 수 없습니다.');
      setLogs(null);
    } finally {
      setIsLoading(false);
    }
  };

  const handlePageChange = async (page: number) => {
    setError('');
    setIsLoading(true);
    setCurrentPage(page);

    try {
      const response = await stockUseCase.getStockLogs({
        barcodeId: barcodeId || undefined,
        productName: productName || undefined,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        page,
        size: 20,
      });
      setLogs(response);
    } catch {
      setError('재고 이력을 조회할 수 없습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="p-6 bg-gray-50 min-h-full">
      <div className="max-w-6xl mx-auto space-y-6">
        <StockSearchForm
          barcodeId={barcodeId}
          productName={productName}
          startDate={startDate}
          endDate={endDate}
          onBarcodeChange={setBarcodeId}
          onProductNameChange={setProductName}
          onStartDateChange={setStartDate}
          onEndDateChange={setEndDate}
          onSearch={handleSearch}
          isLoading={isLoading}
        />

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
            {error}
          </div>
        )}

        {hasSearched && logs && (
          <StockSearchTable
            logs={logs.content}
            currentPage={currentPage}
            totalElements={logs.totalElements}
            onPageChange={handlePageChange}
            isLoading={isLoading}
          />
        )}

        {hasSearched && !logs && !error && (
          <div className="bg-white rounded-lg p-8 text-center text-gray-500">
            검색 결과가 없습니다.
          </div>
        )}
      </div>
    </div>
  );
}
