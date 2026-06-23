'use client';

import { useState, useEffect } from 'react';
import type { CreateUserRequest } from '@/domain/repositories/UserRepository';

interface UserRegistrationFormProps {
  onSubmit: (data: CreateUserRequest) => Promise<void>;
  onCheckEmail: (email: string) => Promise<boolean>;
  isLoading: boolean;
  error: string | null;
  resetTrigger: number;
}

export function UserRegistrationForm({
  onSubmit,
  onCheckEmail,
  isLoading,
  error,
  resetTrigger,
}: UserRegistrationFormProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [emailError, setEmailError] = useState<string | null>(null);
  const [emailSuccess, setEmailSuccess] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [nameError, setNameError] = useState<string | null>(null);
  const [isCheckingEmail, setIsCheckingEmail] = useState(false);

  useEffect(() => {
    setEmail('');
    setPassword('');
    setName('');
    setEmailError(null);
    setEmailSuccess(false);
    setPasswordError(null);
    setNameError(null);
    setIsCheckingEmail(false);
  }, [resetTrigger]);

  const handleEmailCheck = async (): Promise<void> => {
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return;

    setIsCheckingEmail(true);
    try {
      const exists = await onCheckEmail(email);
      if (exists) {
        setEmailError('이미 사용 중인 이메일입니다');
        setEmailSuccess(false);
      } else {
        setEmailError(null);
        setEmailSuccess(true);
      }
    } catch {
      setEmailError(null);
      setEmailSuccess(false);
    } finally {
      setIsCheckingEmail(false);
    }
  };

  const handleEmailBlur = async (): Promise<void> => {
    await handleEmailCheck();
  };

  const handleReset = (): void => {
    setEmail('');
    setPassword('');
    setName('');
    setEmailError(null);
    setEmailSuccess(false);
    setPasswordError(null);
    setNameError(null);
    setIsCheckingEmail(false);
  };

  const handleSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();

    const errors: Record<string, string> = {};

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      errors.email = '유효한 이메일 주소를 입력하세요';
    }

    if (!password || password.length < 8 || password.length > 20) {
      errors.password = '비밀번호는 8-20자리여야 합니다';
    }

    if (!name || name.length < 2 || name.length > 50) {
      errors.name = '이름은 2-50자리여야 합니다';
    }

    if (Object.keys(errors).length > 0) {
      setEmailError(errors.email || null);
      setEmailSuccess(false);
      setPasswordError(errors.password || null);
      setNameError(errors.name || null);
      return;
    }

    setEmailError(null);
    setPasswordError(null);
    setNameError(null);

    await onSubmit({ email, password, name });
  };

  const isSubmitDisabled = isLoading || !email || !password || !name || !emailSuccess;

  return (
    <form onSubmit={handleSubmit} className="max-w-2xl flex flex-col min-h-[calc(100vh-7rem)] space-y-8">
      <h1 className="text-3xl font-bold">회원등록</h1>

      {error && (
        <div className="bg-red-50 border-l-4 border-red-400 p-4 text-red-700 rounded-lg">
          {error}
        </div>
      )}

      {/* Required Fields */}
      <fieldset className="border border-gray-200 rounded-lg p-6 bg-white">
        <legend className="text-lg font-semibold text-gray-900 px-2">필수 항목</legend>
        <div className="space-y-4">
          {/* Email */}
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-900 mb-1">
              이메일
            </label>
            <div className="flex gap-2">
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setEmailError(null);
                  setEmailSuccess(false);
                }}
                onBlur={handleEmailBlur}
                placeholder="이메일을 입력하세요"
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              {!emailSuccess ? (
                <button
                  type="button"
                  onClick={handleEmailCheck}
                  disabled={!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || isCheckingEmail}
                  className="px-4 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed whitespace-nowrap"
                >
                  {isCheckingEmail ? '확인 중...' : '중복확인'}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleReset}
                  className="px-4 py-2 bg-gray-500 text-white font-medium rounded-lg hover:bg-gray-600 transition-colors whitespace-nowrap"
                >
                  리셋
                </button>
              )}
            </div>
            {emailError && !isCheckingEmail && (
              <p className="text-red-600 text-sm mt-1">{emailError}</p>
            )}
            {emailSuccess && !isCheckingEmail && (
              <p className="text-green-600 text-sm mt-1">사용 가능한 이메일입니다</p>
            )}
          </div>

          {/* Password */}
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-900 mb-1">
              비밀번호
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={!emailSuccess}
              placeholder="8-20자리 비밀번호를 입력하세요"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed disabled:text-gray-500"
            />
            {passwordError && (
              <p className="text-red-600 text-sm mt-1">{passwordError}</p>
            )}
          </div>

          {/* Name */}
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-gray-900 mb-1">
              이름
            </label>
            <input
              id="name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={!emailSuccess}
              placeholder="이름을 입력하세요"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed disabled:text-gray-500"
            />
            {nameError && (
              <p className="text-red-600 text-sm mt-1">{nameError}</p>
            )}
          </div>
        </div>
      </fieldset>

      {/* Submit Button (mt-auto로 하단 밀착 + sticky로 스크롤 시 고정) */}
      <div className="mt-auto sticky bottom-0 -mb-6 bg-page border-t border-gray-200 p-4 -mx-6 px-6">
        <button
          type="submit"
          disabled={isSubmitDisabled}
          className="w-full px-6 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
        >
          {isLoading ? '등록 중...' : '회원등록'}
        </button>
      </div>
    </form>
  );
}
