# Clean Architecture Implementation

## Layer Overview

```
┌──────────────────────────────────────────────────┐
│  Presentation Layer (UI/Components)              │
│  └─ src/app/login/components/LoginForm.tsx       │
└───────────────────┬────────────────────────────┘
                    │
┌───────────────────▼────────────────────────────┐
│  Application Layer (Use Cases/DTOs)            │
│  ├─ src/application/usecases/LoginUseCase.ts   │
│  ├─ src/application/dto/*.ts                   │
│  └─ Business logic (orchestration)             │
└───────────────────┬────────────────────────────┘
                    │
┌───────────────────▼────────────────────────────┐
│  Infrastructure Layer (Implementation)         │
│  ├─ src/infrastructure/repositories/           │
│  ├─ src/infrastructure/api/axiosInstance.ts    │
│  ├─ src/infrastructure/auth/tokenStorage.ts    │
│  └─ External services (HTTP, Storage, etc)    │
└───────────────────┬────────────────────────────┘
                    │
┌───────────────────▼────────────────────────────┐
│  Domain Layer (Entities/Interfaces)            │
│  ├─ src/domain/repositories/AuthRepository.ts  │
│  └─ Pure business rules (no framework)         │
└──────────────────────────────────────────────────┘
```

## Design Patterns

### Dependency Injection
- LoginUseCase receives AuthRepository via constructor
- Benefits: Testability, loose coupling, easy to mock

### Repository Pattern
- AuthRepository interface defines contracts
- AuthRepositoryImpl provides implementation
- Benefits: Abstraction, swappable implementations

### Data Transfer Objects (DTOs)
- LoginRequestDto, LoginResponseDto
- Benefits: Type safety, contract clarity

## Extension Points

### Adding New Authentication Methods
1. Create new Use Case (e.g., `SignUpUseCase`)
2. Extend `AuthRepository` interface
3. Implement in `AuthRepositoryImpl`
4. Create new form component

### Adding Role-Based Access
1. Store role in tokenStorage
2. Create middleware to check role
3. Protect routes based on role
4. Show/hide UI based on role

### Adding Social Login
1. Create `SocialAuthUseCase`
2. Implement in `AuthRepositoryImpl`
3. Create social login button in LoginForm
4. Handle OAuth callback

## Design Decisions & Trade-offs

| Decision | Reason | Trade-off |
|----------|--------|-----------|
| Cookie-based tokens | Secure (HTTP-only), accessible server-side | Cannot use with cross-domain requests |
| Zod validation | Type-safe, better DX | Slightly larger bundle |
| react-hook-form | Minimal re-renders, flexible | Learning curve |
| Clean Architecture | Testable, maintainable, scalable | More boilerplate initially |

## Data Flow (Architecture Level)

```
User Input
    ↓
Presentation Layer (LoginForm)
    ↓
Application Layer (LoginUseCase)
    ↓
Infrastructure Layer (AuthRepository, API, Storage)
    ↓
Backend API
    ↓
Response handling (token storage, redirect)
```

**Note:** For detailed step-by-step flow, see [LOGIN_FEATURE.md](./LOGIN_FEATURE.md#form-submission-flow)
