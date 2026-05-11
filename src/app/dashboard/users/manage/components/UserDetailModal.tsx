'use client';

import { useMemo, useState, useEffect } from 'react';
import axios from 'axios';
import { UserRepositoryImpl } from '@/infrastructure/repositories/UserRepositoryImpl';
import { UpdateUserUseCase } from '@/application/usecases/UpdateUserUseCase';
import type { User } from '@/domain/entities/User';

interface UserDetailModalProps {
  user: User;
  isOpen: boolean;
  onClose: () => void;
  onUpdated: (updatedUser: User) => void;
}

function formatDate(dateString: string): string {
  return dateString.substring(0, 10);
}

export function UserDetailModal({
  user,
  isOpen,
  onClose,
  onUpdated,
}: UserDetailModalProps) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'GUEST' | 'USER' | 'ADMIN'>('GUEST');
  const [nameError, setNameError] = useState<string | null>(null);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [isCheckingEmail, setIsCheckingEmail] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const updateUserUseCase = useMemo(() => {
    const repository = new UserRepositoryImpl();
    return new UpdateUserUseCase(repository);
  }, []);

  useEffect(() => {
    if (user) {
      setName(user.name);
      setEmail(user.email);
      setRole(user.role);
      setNameError(null);
      setEmailError(null);
      setError(null);
    }
  }, [user]);

  const handleEmailBlur = async (): Promise<void> => {
    // Skip check if email unchanged from original
    if (email === user.email) {
      setEmailError(null);
      return;
    }

    // Skip if invalid format
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return;

    setIsCheckingEmail(true);
    try {
      const exists = await updateUserUseCase.checkEmailExists(email);
      setEmailError(exists ? '이미 사용 중인 이메일입니다' : null);
    } catch {
      setEmailError(null);
    } finally {
      setIsCheckingEmail(false);
    }
  };

  const handleSave = async (): Promise<void> => {
    try {
      setIsLoading(true);
      setError(null);

      // Validate name
      if (!name || name.length < 2 || name.length > 50) {
        setNameError('이름은 2-50자리여야 합니다');
        setIsLoading(false);
        return;
      }

      // Validate email format
      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        setEmailError('유효한 이메일 주소를 입력하세요');
        setIsLoading(false);
        return;
      }

      // Block if email duplicate error exists
      if (emailError) {
        setIsLoading(false);
        return;
      }

      const updatedUser = await updateUserUseCase.updateUser(user.id, {
        name,
        email,
        role,
      });
      onUpdated(updatedUser);
    } catch (err) {
      if (axios.isAxiosError(err) && err.response?.status === 400) {
        setError('이미 사용 중인 이메일입니다');
      } else if (axios.isAxiosError(err) && err.response?.status === 403) {
        setError('권한이 없습니다');
      } else {
        setError(err instanceof Error ? err.message : '수정 중 오류가 발생했습니다');
      }
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 p-4">
      <div className="bg-white rounded-lg shadow-lg max-w-md w-full p-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-6">회원 정보 수정</h2>

        {error && (
          <div className="mb-6 bg-red-50 border-l-4 border-red-200 p-4 text-red-700">
            {error}
          </div>
        )}

        <div className="space-y-4">
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-2">
              이름
            </label>
            <input
              id="name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={isLoading}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none disabled:bg-gray-100 disabled:cursor-not-allowed"
            />
            {nameError && (
              <p className="mt-1 text-sm text-red-600">{nameError}</p>
            )}
          </div>

          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
              이메일
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onBlur={handleEmailBlur}
              disabled={isLoading}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none disabled:bg-gray-100 disabled:cursor-not-allowed"
            />
            {isCheckingEmail && (
              <p className="mt-1 text-sm text-blue-600">확인 중...</p>
            )}
            {emailError && !isCheckingEmail && (
              <p className="mt-1 text-sm text-red-600">{emailError}</p>
            )}
          </div>

          <div>
            <label htmlFor="role" className="block text-sm font-medium text-gray-700 mb-2">
              역할
            </label>
            <select
              id="role"
              value={role}
              onChange={(e) => setRole(e.target.value as 'GUEST' | 'USER' | 'ADMIN')}
              disabled={isLoading}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none disabled:bg-gray-100 disabled:cursor-not-allowed"
            >
              <option value="GUEST">GUEST</option>
              <option value="USER">USER</option>
              <option value="ADMIN">ADMIN</option>
            </select>
          </div>

          <div>
            <label htmlFor="createdAt" className="block text-sm font-medium text-gray-700 mb-2">
              가입일
            </label>
            <input
              id="createdAt"
              type="text"
              value={formatDate(user.createdAt)}
              readOnly
              disabled
              className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-100 text-gray-600 cursor-not-allowed outline-none"
            />
          </div>

          <div>
            <label htmlFor="updatedAt" className="block text-sm font-medium text-gray-700 mb-2">
              수정일
            </label>
            <input
              id="updatedAt"
              type="text"
              value={formatDate(user.updatedAt)}
              readOnly
              disabled
              className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-100 text-gray-600 cursor-not-allowed outline-none"
            />
          </div>
        </div>

        <div className="flex gap-4 mt-6">
          <button
            onClick={handleSave}
            disabled={isLoading || emailError !== null || isCheckingEmail}
            className="flex-1 px-4 py-2 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors disabled:bg-blue-400 disabled:cursor-not-allowed"
          >
            {isLoading ? '저장 중...' : '저장'}
          </button>
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 bg-gray-600 text-white font-semibold rounded-lg hover:bg-gray-700 transition-colors"
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  );
}
