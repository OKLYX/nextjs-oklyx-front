# Testing Strategy

## Test Environment

- Framework: Jest
- Component Testing: React Testing Library
- Coverage: 92.1% (Statements, Branches, Functions, Lines)

## Test Organization

```
src/
├── application/usecases/__tests__/
│   └── LoginUseCase.test.ts (11 tests)
└── app/login/components/__tests__/
    └── LoginForm.test.tsx (11 tests)
```

## Running Tests

```bash
# Run all tests once
npm test

# Run tests in watch mode (re-run on file change)
npm run test:watch

# Generate coverage report
npm run test:coverage
```

## Test Categories

### LoginUseCase Tests (11 tests)

**Token Storage (3 tests)**
- Should store token on successful login
- Should not call setToken if login fails
- Should include all response fields

**Error Handling (3 tests)**
- Should throw error with message from repository
- Should throw default message for non-Error exceptions
- Should throw default message if error is null

**Repository Interaction (1 test)**
- Should call authRepository.login with correct parameters

### LoginForm Tests (11 tests)

**Rendering (4 tests)**
- Should render email input
- Should render password input
- Should render submit button
- Should have correct input types

**Validation (3 tests)**
- Should prevent submission with empty fields
- Should allow submission with valid email
- Should not submit with password < 6 characters

**API Integration (5 tests)**
- Should call LoginUseCase.login on valid submit
- Should redirect to dashboard on success
- Should display error message on failure
- Should not redirect on failure
- Should not call setToken on error

**Loading State (3 tests)**
- Should show loading text and disable button during submission
- Should re-enable button after error
- Should disable input fields while loading

**User Interaction (2 tests)**
- Should allow typing in email field
- Should allow typing in password field

## Writing New Tests

### Example: Test API Error Handling

```typescript
it('should display network error message', async () => {
  const user = userEvent.setup();
  mockLoginUseCase.mockRejectedValue(new Error('Network timeout'));

  render(<LoginForm />);
  
  await user.type(screen.getByPlaceholderText(/email/i), 'test@example.com');
  await user.type(screen.getByPlaceholderText(/password/i), 'password123');
  await user.click(screen.getByRole('button', { name: /login/i }));

  expect(await screen.findByText(/network timeout/i)).toBeInTheDocument();
});
```

## Coverage Requirements

- Minimum: 80% for all metrics
- Current: 92.1% (Statements, Lines), 91.66% (Branches), 80% (Functions)
- Target: 90%+ for production

## Best Practices

1. **Mock External Dependencies**: Mock useRouter, tokenStorage, API calls
2. **Use waitFor**: For async operations and state changes
3. **Test Behavior**: Focus on what user sees, not implementation
4. **Test Error Paths**: Both success and failure scenarios
5. **Use Descriptive Names**: Test name should explain what's being tested
