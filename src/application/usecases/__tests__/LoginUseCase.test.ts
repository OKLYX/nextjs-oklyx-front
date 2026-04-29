import { LoginUseCase } from '@/application/usecases/LoginUseCase';
import { IAuthRepository } from '@/domain/repositories/IAuthRepository';
import { LoginResponseDto } from '@/application/dto/LoginResponseDto';
import * as tokenStorageModule from '@/infrastructure/auth/tokenStorage';

jest.mock('@/infrastructure/auth/tokenStorage');

describe('LoginUseCase', () => {
  let mockAuthRepository: jest.Mocked<IAuthRepository>;
  let mockTokenStorage: jest.Mocked<typeof tokenStorageModule.tokenStorage>;
  let useCase: LoginUseCase;

  beforeEach(() => {
    jest.clearAllMocks();

    mockAuthRepository = {
      login: jest.fn(),
    } as jest.Mocked<IAuthRepository>;

    mockTokenStorage = tokenStorageModule.tokenStorage as jest.Mocked<
      typeof tokenStorageModule.tokenStorage
    >;

    useCase = new LoginUseCase(mockAuthRepository);
  });

  describe('Token Storage', () => {
    it('should store token on successful login', async () => {
      const mockResponse: LoginResponseDto = {
        token: 'jwt-token-123',
        tokenType: 'Bearer',
        email: 'test@example.com',
        name: 'Test User',
        role: 'user',
        expiresIn: 3600,
      };

      mockAuthRepository.login.mockResolvedValue(mockResponse);

      await useCase.login('test@example.com', 'password123');

      expect(mockAuthRepository.login).toHaveBeenCalledWith({
        email: 'test@example.com',
        password: 'password123',
      });
      expect(mockTokenStorage.setToken).toHaveBeenCalledWith('jwt-token-123');
    });

    it('should not call setToken if login fails', async () => {
      mockAuthRepository.login.mockRejectedValue(new Error('Invalid credentials'));

      await expect(useCase.login('test@example.com', 'wrong-password')).rejects.toThrow(
        'Invalid credentials'
      );

      expect(mockTokenStorage.setToken).not.toHaveBeenCalled();
    });
  });

  describe('Error Handling', () => {
    it('should throw error with message from repository', async () => {
      const errorMessage = 'Invalid email or password';
      mockAuthRepository.login.mockRejectedValue(new Error(errorMessage));

      await expect(useCase.login('test@example.com', 'wrong-password')).rejects.toThrow(
        errorMessage
      );
    });

    it('should throw default error message if error is not Error instance', async () => {
      mockAuthRepository.login.mockRejectedValue('Some string error');

      await expect(useCase.login('test@example.com', 'password')).rejects.toThrow(
        'Login failed. Please try again.'
      );
    });

    it('should throw default error message if error is null/undefined', async () => {
      mockAuthRepository.login.mockRejectedValue(null);

      await expect(useCase.login('test@example.com', 'password')).rejects.toThrow(
        'Login failed. Please try again.'
      );
    });
  });

  describe('Repository Interaction', () => {
    it('should call authRepository.login with correct parameters', async () => {
      const mockResponse: LoginResponseDto = {
        token: 'token',
        tokenType: 'Bearer',
        email: 'user@example.com',
        name: 'User',
        role: 'user',
        expiresIn: 3600,
      };

      mockAuthRepository.login.mockResolvedValue(mockResponse);

      const email = 'user@example.com';
      const password = 'secure-password';

      await useCase.login(email, password);

      expect(mockAuthRepository.login).toHaveBeenCalledTimes(1);
      expect(mockAuthRepository.login).toHaveBeenCalledWith({
        email,
        password,
      });
    });
  });
});
