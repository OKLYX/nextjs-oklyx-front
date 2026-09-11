'use client';

import { Card } from '@/presentation/components/ui/Card';
import { Button } from '@/presentation/components/ui/Button';

interface ProductListingSearchCardProps {
  searchPlatform: string;
  onSearchChange: (value: string) => void;
  onSearch: () => void;
  isLoading: boolean;
  resultCount: number;
  unlinkedOnly: boolean;
  // 토글 즉시 page=0 재검색은 컨테이너 책임.
  onUnlinkedOnlyChange: (next: boolean) => void;
}

export function ProductListingSearchCard({
  searchPlatform,
  onSearchChange,
  onSearch,
  isLoading,
  resultCount,
  unlinkedOnly,
  onUnlinkedOnlyChange,
}: ProductListingSearchCardProps) {

  return (
    <Card>
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">플랫폼</label>
          <select
            value={searchPlatform}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
          >
            <option value="">선택하세요</option>
            <option value="COUPANG">쿠팡</option>
            <option value="GMARKET">지마켓</option>
            <option value="AUCTION">옥션</option>
            <option value="SMARTSTORE">스마트스토어</option>
          </select>
        </div>

        <div>
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={unlinkedOnly}
              onChange={(e) => onUnlinkedOnlyChange(e.target.checked)}
              className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            마스터 미연결만
          </label>
        </div>

        <div className="flex items-center justify-between">
          <div>
            {resultCount > 0 && (
              <p className="text-sm text-gray-600">{resultCount}개의 결과</p>
            )}
          </div>
          <Button
            onClick={onSearch}
            disabled={isLoading}
          >
            {isLoading ? '검색 중...' : '검색'}
          </Button>
        </div>
      </div>
    </Card>
  );
}
