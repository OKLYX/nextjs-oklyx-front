'use client';

interface UserSearchFormProps {
  nameSearch: string;
  emailSearch: string;
  isLoading: boolean;
  onNameChange: (value: string) => void;
  onEmailChange: (value: string) => void;
  onSearch: () => void;
}

export function UserSearchForm({
  nameSearch,
  emailSearch,
  isLoading,
  onNameChange,
  onEmailChange,
  onSearch,
}: UserSearchFormProps) {
  const handleKeyDown = (e: React.KeyboardEvent): void => {
    if (e.key === 'Enter') {
      onSearch();
    }
  };

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h2 className="text-2xl font-bold text-gray-900 mb-6">회원 검색</h2>

      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-2">
              이름
            </label>
            <input
              id="name"
              type="text"
              value={nameSearch}
              onChange={(e) => onNameChange(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="이름을 입력하세요"
              disabled={isLoading}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none disabled:bg-gray-100 disabled:cursor-not-allowed"
            />
          </div>

          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
              이메일
            </label>
            <input
              id="email"
              type="email"
              value={emailSearch}
              onChange={(e) => onEmailChange(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="이메일을 입력하세요"
              disabled={isLoading}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none disabled:bg-gray-100 disabled:cursor-not-allowed"
            />
          </div>
        </div>

        <div className="flex justify-end pt-2">
          <button
            onClick={onSearch}
            disabled={isLoading}
            className="px-6 py-2 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors disabled:bg-blue-400 disabled:cursor-not-allowed"
          >
            {isLoading ? '조회 중...' : '조회'}
          </button>
        </div>
      </div>
    </div>
  );
}
