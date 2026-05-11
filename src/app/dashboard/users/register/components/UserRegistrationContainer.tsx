'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import axios from 'axios';
import { UserRepositoryImpl } from '@/infrastructure/repositories/UserRepositoryImpl';
import { CreateUserUseCase } from '@/application/usecases/CreateUserUseCase';
import type { CreateUserRequest } from '@/domain/repositories/UserRepository';
import { ROUTES } from '@/config/routes';
import { UserRegistrationForm } from './UserRegistrationForm';
import { UserRegistrationSuccessDialog } from './UserRegistrationSuccessDialog';

export function UserRegistrationContainer() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showSuccessDialog, setShowSuccessDialog] = useState(false);
  const [resetTrigger, setResetTrigger] = useState(0);

  const createUserUseCase = useMemo(() => {
    const repository = new UserRepositoryImpl();
    return new CreateUserUseCase(repository);
  }, []);

  const handleCheckEmail = async (email: string): Promise<boolean> => {
    return createUserUseCase.checkEmailExists(email);
  };

  const handleSubmit = async (data: CreateUserRequest): Promise<void> => {
    try {
      setIsLoading(true);
      setError(null);
      await createUserUseCase.createUser(data);
      setShowSuccessDialog(true);
    } catch (err) {
      if (axios.isAxiosError(err) && err.response?.status === 409) {
        setError('이미 사용 중인 이메일입니다');
      } else {
        setError(err instanceof Error ? err.message : '등록 중 오류가 발생했습니다');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoToUserManage = (): void => {
    router.push(ROUTES.USER_MANAGE);
  };

  const handleRegisterAnother = (): void => {
    setResetTrigger((prev) => prev + 1);
    setShowSuccessDialog(false);
    setError(null);
  };

  return (
    <div className="p-6 bg-gray-50 min-h-full">
      <div className="max-w-md mx-auto">
        <UserRegistrationForm
          onSubmit={handleSubmit}
          onCheckEmail={handleCheckEmail}
          isLoading={isLoading}
          error={error}
          resetTrigger={resetTrigger}
        />
        <UserRegistrationSuccessDialog
          isOpen={showSuccessDialog}
          onGoToUserManage={handleGoToUserManage}
          onRegisterAnother={handleRegisterAnother}
        />
      </div>
    </div>
  );
}
