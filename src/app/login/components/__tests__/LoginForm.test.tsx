import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LoginForm } from '@/app/login/components/LoginForm';
import { ROUTES } from '@/config/routes';
import * as navigationModule from 'next/navigation';
import * as loginUseCaseModule from '@/application/usecases/LoginUseCase';

jest.mock('next/navigation');
jest.mock('@/application/usecases/LoginUseCase');
jest.mock('@/infrastructure/repositories/AuthRepositoryImpl');

describe('LoginForm', () => {
  let mockPush: jest.Mock;
  let mockLoginUseCase: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();

    mockPush = jest.fn();
    mockLoginUseCase = jest.fn();

    const mockUseRouter = navigationModule.useRouter as jest.Mock;
    mockUseRouter.mockReturnValue({
      push: mockPush,
    });

    const MockLoginUseCase = loginUseCaseModule.LoginUseCase as jest.Mock;
    MockLoginUseCase.mockImplementation(() => ({
      login: mockLoginUseCase,
    }));
  });

  describe('Rendering', () => {
    it('should render email input with placeholder', () => {
      render(<LoginForm />);
      const emailInput = screen.getByPlaceholderText(/email address/i);
      expect(emailInput).toBeInTheDocument();
    });

    it('should render password input with placeholder', () => {
      render(<LoginForm />);
      const passwordInput = screen.getByPlaceholderText(/password/i);
      expect(passwordInput).toBeInTheDocument();
    });

    it('should render submit button', () => {
      render(<LoginForm />);
      const button = screen.getByRole('button', { name: /login/i });
      expect(button).toBeInTheDocument();
    });

    it('should have email and password inputs of correct type', () => {
      render(<LoginForm />);
      const emailInput = screen.getByPlaceholderText(/email address/i) as HTMLInputElement;
      const passwordInput = screen.getByPlaceholderText(/password/i) as HTMLInputElement;

      expect(emailInput.type).toBe('email');
      expect(passwordInput.type).toBe('password');
    });
  });

  describe('Form Validation', () => {
    it('should prevent form submission with empty fields', async () => {
      const user = userEvent.setup();
      render(<LoginForm />);

      await user.click(screen.getByRole('button', { name: /login/i }));

      await waitFor(() => {
        expect(mockLoginUseCase).not.toHaveBeenCalled();
      });
      expect(mockPush).not.toHaveBeenCalled();
    });

    it('should allow submission with valid email format', async () => {
      const user = userEvent.setup();
      mockLoginUseCase.mockResolvedValue(undefined);

      render(<LoginForm />);

      await user.type(screen.getByPlaceholderText(/email address/i), 'test@example.com');
      await user.type(screen.getByPlaceholderText(/password/i), 'password123');
      await user.click(screen.getByRole('button', { name: /login/i }));

      await waitFor(() => {
        expect(mockLoginUseCase).toHaveBeenCalledWith('test@example.com', 'password123');
      });
    });

    it('should not submit with password < 6 characters', async () => {
      const user = userEvent.setup();
      render(<LoginForm />);

      await user.type(screen.getByPlaceholderText(/email address/i), 'test@example.com');
      await user.type(screen.getByPlaceholderText(/password/i), '123');
      await user.click(screen.getByRole('button', { name: /login/i }));

      await waitFor(() => {
        expect(mockLoginUseCase).not.toHaveBeenCalled();
      });
    });
  });

  describe('API Integration', () => {
    it('should call LoginUseCase.login with email and password on valid submit', async () => {
      const user = userEvent.setup();
      mockLoginUseCase.mockResolvedValue(undefined);

      render(<LoginForm />);

      await user.type(screen.getByPlaceholderText(/email address/i), 'test@example.com');
      await user.type(screen.getByPlaceholderText(/password/i), 'password123');
      await user.click(screen.getByRole('button', { name: /login/i }));

      await waitFor(() => {
        expect(mockLoginUseCase).toHaveBeenCalledWith('test@example.com', 'password123');
      });
    });

    it('should redirect to dashboard on successful login', async () => {
      const user = userEvent.setup();
      mockLoginUseCase.mockResolvedValue(undefined);

      render(<LoginForm />);

      await user.type(screen.getByPlaceholderText(/email address/i), 'test@example.com');
      await user.type(screen.getByPlaceholderText(/password/i), 'password123');
      await user.click(screen.getByRole('button', { name: /login/i }));

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith(ROUTES.DASHBOARD);
      });
    });

    it('should display error message on login failure', async () => {
      const user = userEvent.setup();
      mockLoginUseCase.mockRejectedValue(new Error('Invalid credentials'));

      render(<LoginForm />);

      await user.type(screen.getByPlaceholderText(/email address/i), 'test@example.com');
      await user.type(screen.getByPlaceholderText(/password/i), 'password123');
      await user.click(screen.getByRole('button', { name: /login/i }));

      expect(await screen.findByText(/invalid credentials/i)).toBeInTheDocument();
    });

    it('should not redirect on login failure', async () => {
      const user = userEvent.setup();
      mockLoginUseCase.mockRejectedValue(new Error('Network error'));

      render(<LoginForm />);

      await user.type(screen.getByPlaceholderText(/email address/i), 'test@example.com');
      await user.type(screen.getByPlaceholderText(/password/i), 'password123');
      await user.click(screen.getByRole('button', { name: /login/i }));

      expect(mockPush).not.toHaveBeenCalled();
    });

    it('should display default error message for non-Error exceptions', async () => {
      const user = userEvent.setup();
      mockLoginUseCase.mockRejectedValue('String error');

      render(<LoginForm />);

      await user.type(screen.getByPlaceholderText(/email address/i), 'test@example.com');
      await user.type(screen.getByPlaceholderText(/password/i), 'password123');
      await user.click(screen.getByRole('button', { name: /login/i }));

      expect(await screen.findByText(/login failed. please try again/i)).toBeInTheDocument();
    });
  });

  describe('Loading State', () => {
    it('should show loading text and disable button during submission', async () => {
      const user = userEvent.setup();
      mockLoginUseCase.mockImplementation(
        () => new Promise(resolve => setTimeout(resolve, 100))
      );

      render(<LoginForm />);

      const submitButton = screen.getByRole('button', { name: /login/i });

      await user.type(screen.getByPlaceholderText(/email address/i), 'test@example.com');
      await user.type(screen.getByPlaceholderText(/password/i), 'password123');
      await user.click(submitButton);

      expect(screen.getByRole('button', { name: /logging in/i })).toBeDisabled();
    });

    it('should re-enable button and show Login text after error', async () => {
      const user = userEvent.setup();
      mockLoginUseCase.mockRejectedValue(new Error('Login failed'));

      render(<LoginForm />);

      await user.type(screen.getByPlaceholderText(/email address/i), 'test@example.com');
      await user.type(screen.getByPlaceholderText(/password/i), 'password123');
      await user.click(screen.getByRole('button', { name: /login/i }));

      expect(await screen.findByText(/login failed/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /^login$/i })).not.toBeDisabled();
    });

    it('should disable input fields while loading', async () => {
      const user = userEvent.setup();
      mockLoginUseCase.mockImplementation(
        () => new Promise(resolve => setTimeout(resolve, 100))
      );

      render(<LoginForm />);

      const emailInput = screen.getByPlaceholderText(/email address/i) as HTMLInputElement;
      const passwordInput = screen.getByPlaceholderText(/password/i) as HTMLInputElement;

      await user.type(emailInput, 'test@example.com');
      await user.type(passwordInput, 'password123');
      await user.click(screen.getByRole('button', { name: /login/i }));

      expect(emailInput.disabled).toBe(true);
      expect(passwordInput.disabled).toBe(true);
    });
  });

  describe('User Interaction', () => {
    it('should allow typing in email field', async () => {
      const user = userEvent.setup();
      render(<LoginForm />);

      const emailInput = screen.getByPlaceholderText(/email address/i) as HTMLInputElement;
      await user.type(emailInput, 'test@example.com');

      expect(emailInput.value).toBe('test@example.com');
    });

    it('should allow typing in password field', async () => {
      const user = userEvent.setup();
      render(<LoginForm />);

      const passwordInput = screen.getByPlaceholderText(/password/i) as HTMLInputElement;
      await user.type(passwordInput, 'password123');

      expect(passwordInput.value).toBe('password123');
    });
  });
});
