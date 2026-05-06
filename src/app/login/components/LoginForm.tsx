'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { loginFormSchema, type LoginFormInput } from '@/application/dto/LoginFormSchema';
import { LoginUseCase } from '@/application/usecases/LoginUseCase';
import { AuthRepositoryImpl } from '@/infrastructure/repositories/AuthRepositoryImpl';
import { ROUTES } from '@/config/routes';

export function LoginForm() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormInput>({
    resolver: zodResolver(loginFormSchema),
  });

  const onSubmit = async (data: LoginFormInput) => {
    setIsLoading(true);
    setApiError(null);

    try {
      const loginUseCase = new LoginUseCase(new AuthRepositoryImpl());
      await loginUseCase.login(data.email, data.password);
      router.push(ROUTES.DASHBOARD);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Login failed. Please try again.';
      setApiError(errorMessage);
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md px-4">
      <div className="mb-24 flex justify-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/oklyx_letter_logo.png" alt="OKLYX Logo" className="h-16" />
      </div>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-gray-700">
            Email
          </label>
          <input
            {...register('email')}
            type="email"
            id="email"
            placeholder="Email address"
            className="mt-1 w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
            disabled={isLoading}
          />
          {errors.email && <p className="mt-1 text-sm text-red-600">{errors.email.message}</p>}
        </div>

        <div>
          <label htmlFor="password" className="block text-sm font-medium text-gray-700">
            Password
          </label>
          <input
            {...register('password')}
            type="password"
            id="password"
            placeholder="Password"
            className="mt-1 w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
            disabled={isLoading}
          />
          {errors.password && (
            <p className="mt-1 text-sm text-red-600">{errors.password.message}</p>
          )}
        </div>

        {apiError && <p className="text-sm text-red-600 bg-red-50 p-3 rounded-lg">{apiError}</p>}

        <button
          type="submit"
          disabled={isLoading}
          className="w-full bg-black font-bold py-2 px-4 rounded-lg hover:bg-gray-900 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          style={{ color: '#fdc515' }}
        >
          {isLoading ? 'LOGGING IN...' : 'LOGIN'}
        </button>
      </form>
    </div>
  );
}
