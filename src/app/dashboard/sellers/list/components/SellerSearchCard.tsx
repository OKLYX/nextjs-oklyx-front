'use client';

import { Card } from '@/presentation/components/ui/Card';
import { Button } from '@/presentation/components/ui/Button';

interface SellerSearchCardProps {
  searchName: string;
  onSearchChange: (value: string) => void;
  onSearch: () => void;
  isLoading: boolean;
  resultCount: number;
  onCreateClick?: () => void;
}

export function SellerSearchCard({
  searchName,
  onSearchChange,
  onSearch,
  isLoading,
  resultCount,
  onCreateClick,
}: SellerSearchCardProps) {
  return (
    <Card>
      <h2 className="text-2xl font-semibold mb-6 text-gray-900">판매자 검색</h2>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">판매자명</label>
          <input
            type="text"
            placeholder="판매자명 검색"
            value={searchName}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
          />
        </div>

        <div className="flex items-center justify-between">
          <div>
            {resultCount > 0 && (
              <p className="text-sm text-gray-600">검색 결과 {resultCount}개</p>
            )}
          </div>
          <div className="flex gap-2">
            <button
              onClick={onCreateClick}
              className="px-6 py-2 bg-green-600 text-white font-semibold rounded-lg hover:bg-green-700 transition-colors"
            >
              판매자 추가
            </button>
            <Button
              onClick={onSearch}
              disabled={isLoading}
            >
              {isLoading ? '검색 중...' : '검색'}
            </Button>
          </div>
        </div>
      </div>
    </Card>
  );
}
