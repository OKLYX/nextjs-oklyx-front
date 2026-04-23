# Authentication System

## Overview

OKLYX implements a secure, token-based authentication system using:
- Cookie-based token storage
- JWT token handling
- Server-client authentication flow
- Middleware-based route protection

## Architecture Diagram

```
┌─────────────────────────────────────────────────────┐
│                  Next.js App                        │
├─────────────────────────────────────────────────────┤
│  Login Page (/login)                                │
│  ├─ LoginForm (Client Component)                    │
│  │  ├─ useForm (react-hook-form)                    │
│  │  ├─ Zod Validation                               │
│  │  └─ API Call via LoginUseCase                    │
│  └─ Redirect to /dashboard                          │
├─────────────────────────────────────────────────────┤
│  Infrastructure Layer                               │
│  ├─ AuthRepositoryImpl (API HTTP calls)              │
│  ├─ axiosInstance (with Bearer token injection)     │
│  └─ tokenStorage (Cookie-based)                     │
├─────────────────────────────────────────────────────┤
│  Backend API                                        │
│  └─ POST /api/auth/login (returns JWT token)        │
└─────────────────────────────────────────────────────┘
```

## Key Components

### 1. LoginForm (src/app/login/components/LoginForm.tsx)
- **Purpose**: User interface for login
- **Technologies**: react-hook-form, Zod, react-router
- **State**: isLoading, apiError
- **Behavior**: Form submission, validation, error display, redirect

### 2. LoginUseCase (src/application/usecases/LoginUseCase.ts)
- **Purpose**: Business logic for authentication
- **Responsibility**: Call repository, store token, handle errors
- **Pattern**: Dependency Injection (AuthRepository)
- **Error Handling**: Descriptive error messages

### 3. AuthRepositoryImpl (src/infrastructure/repositories/AuthRepositoryImpl.ts)
- **Purpose**: API communication layer
- **Endpoint**: POST /api/auth/login
- **Responsibility**: HTTP requests, response parsing
- **Integration**: Uses axiosInstance with Bearer token

### 4. tokenStorage (src/infrastructure/auth/tokenStorage.ts)
- **Purpose**: Token persistence
- **Storage**: HTTP-only cookies (oklyx_token)
- **Methods**: getToken(), setToken(), removeToken()
- **Security**: SameSite=Strict, no Secure flag (add for HTTPS)

## Security Considerations

1. **Token Storage**: Cookie with SameSite=Strict prevents CSRF attacks
2. **HTTPS**: Add Secure flag to cookies in production
3. **CORS**: API server must whitelist frontend origin
4. **Validation**: All user input validated on client (Zod) and server
5. **Error Messages**: Don't expose sensitive information in errors

## Data Flow (High-Level)

```
User → Login Form → API Call → Token Storage → Redirect to Dashboard
```

For detailed implementation flow, see [LOGIN_FEATURE.md](./LOGIN_FEATURE.md)

## Middleware Protection

- middleware.ts protects /login route (redirects logged-in users to /dashboard)
- middleware.ts protects /dashboard route (ensures user has valid token)
- middleware.ts handles 401 response from API (clears token, redirects to /login)
