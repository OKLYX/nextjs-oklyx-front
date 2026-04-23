# Login Feature Implementation

## Component Structure

```
src/app/login/
├── page.tsx (Server component wrapper)
└── components/
    └── LoginForm.tsx (Client component)
```

## State Management

### Form State (react-hook-form)
- Managed by `useForm` hook with Zod resolver
- Automatic validation on submit
- Error messages from Zod schema

### UI State (useState)

**isLoading**: API call in progress
- Used to: Disable button/inputs, show "Logging in..." text
  
**apiError**: Server error message
- Used to: Display error below submit button
- Cleared on new submission

## Validation Rules

| Field | Rules | Error Message |
|-------|-------|---------------|
| Email | Required, Valid email format | "Invalid email format" |
| Password | Required, Min 6 characters | "Password must be at least 6 characters" |

## Form Submission Flow

```
1. User clicks "Login" button
   ↓
2. react-hook-form validates fields
   ↓
3. If validation fails → Show inline errors, stop
   ↓
4. If validation passes → setIsLoading(true)
   ↓
5. Call LoginUseCase.login(email, password)
   ↓
6. On success: router.push(ROUTES.HOME)
   ↓
7. On error: Show apiError message, setIsLoading(false)
```

## Error Handling

### Validation Errors
- Shown below each input field
- Cleared when user starts typing
- Prevent form submission

### API Errors
- Displayed below submit button
- Examples: "Invalid credentials", "Network error"
- User can retry immediately

### Network Errors
- Handled by axiosInstance interceptor
- 401 errors trigger logout (handled in middleware)
- Other errors show user-friendly message

## Loading State

- Button disabled: `disabled={isLoading}`
- Button text: `isLoading ? 'Logging in...' : 'Login'`
- Input fields disabled: `disabled={isLoading}`
- Prevents duplicate submissions
