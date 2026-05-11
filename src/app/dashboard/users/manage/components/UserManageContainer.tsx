'use client';

import { useMemo, useState, useEffect } from 'react';
import { UserRepositoryImpl } from '@/infrastructure/repositories/UserRepositoryImpl';
import { GetUsersUseCase } from '@/application/usecases/GetUsersUseCase';
import type { User } from '@/domain/entities/User';
import type { GetUsersResponse } from '@/domain/repositories/UserRepository';
import { UserSearchForm } from './UserSearchForm';
import { UserTable } from './UserTable';

export function UserManageContainer() {
  const [nameSearch, setNameSearch] = useState('');
  const [emailSearch, setEmailSearch] = useState('');
  const [users, setUsers] = useState<User[]>([]);
  const [totalElements, setTotalElements] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [currentPage, setCurrentPage] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);

  const getUsersUseCase = useMemo(() => {
    const repository = new UserRepositoryImpl();
    return new GetUsersUseCase(repository);
  }, []);

  const handleSearch = async (page: number): Promise<void> => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await getUsersUseCase.getUsers({
        name: nameSearch || undefined,
        email: emailSearch || undefined,
        page,
        size: 20,
      });
      setUsers(response.content);
      setTotalElements(response.totalElements);
      setTotalPages(response.totalPages);
      setCurrentPage(response.number);
      setHasSearched(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : '조회 중 오류가 발생했습니다');
    } finally {
      setIsLoading(false);
    }
  };

  const handlePageChange = async (page: number): Promise<void> => {
    await handleSearch(page);
  };

  useEffect(() => {
    handleSearch(0);
  }, []);

  return (
    <div className="p-6 bg-gray-50 min-h-full">
      <div className="max-w-6xl mx-auto space-y-6">
        <UserSearchForm
          nameSearch={nameSearch}
          emailSearch={emailSearch}
          isLoading={isLoading}
          onNameChange={setNameSearch}
          onEmailChange={setEmailSearch}
          onSearch={() => handleSearch(0)}
        />
        <UserTable
          users={users}
          totalElements={totalElements}
          totalPages={totalPages}
          currentPage={currentPage}
          isLoading={isLoading}
          error={error}
          onPageChange={handlePageChange}
        />
      </div>
    </div>
  );
}
