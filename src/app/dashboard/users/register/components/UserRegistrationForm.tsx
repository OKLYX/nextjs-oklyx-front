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
    <div className="bg-white rounded-lg shadow p-6">
      <h2 className="text-2xl font-bold text-gray-900 mb-6">회원등록</h2>

      {error && (
        <div className="mb-6 bg-red-50 border-l-4 border-red-400 p-4 text-red-700">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
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
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
            />
            {!emailSuccess ? (
              <button
                type="button"
                onClick={handleEmailCheck}
                disabled={!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || isCheckingEmail}
                className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed whitespace-nowrap"
              >
                {isCheckingEmail ? '확인 중...' : '중복확인'}
              </button>
            ) : (
              <button
                type="button"
                onClick={handleReset}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors whitespace-nowrap"
              >
                리셋
              </button>
            )}
          </div>
          {emailError && !isCheckingEmail && (
            <p className="mt-1 text-sm text-red-600">{emailError}</p>
          )}
          {emailSuccess && !isCheckingEmail && (
            <p className="mt-1 text-sm text-green-600">사용 가능한 이메일입니다</p>
          )}
        </div>

        <div>
          <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
            비밀번호
          </label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={!emailSuccess}
            placeholder="8-20자리 비밀번호를 입력하세요"
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none disabled:bg-gray-100 disabled:cursor-not-allowed disabled:text-gray-500"
          />
          {passwordError && (
            <p className="mt-1 text-sm text-red-600">{passwordError}</p>
          )}
        </div>

        <div>
          <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-2">
            이름
          </label>
          <input
            id="name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={!emailSuccess}
            placeholder="이름을 입력하세요"
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none disabled:bg-gray-100 disabled:cursor-not-allowed disabled:text-gray-500"
          />
          {nameError && (
            <p className="mt-1 text-sm text-red-600">{nameError}</p>
          )}
        </div>

        <button
          type="submit"
          disabled={isSubmitDisabled}
          className="w-full py-2 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors disabled:bg-blue-400 disabled:cursor-not-allowed"
        >
          {isLoading ? '등록 중...' : '회원등록'}
        </button>
      </form>
    </div>
  );
}
