# API Integration Guide

## Login Endpoint

**Endpoint:** `POST /api/auth/login`

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "password123"
}
```

**Response (200 OK):**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "tokenType": "Bearer",
  "email": "user@example.com",
  "name": "John Doe",
  "role": "user",
  "expiresIn": 3600
}
```

**Error Response (401):**
```json
{
  "message": "Invalid email or password"
}
```

## HTTP Client Configuration

**axiosInstance** (src/infrastructure/api/axiosInstance.ts):
- Base URL: `process.env.NEXT_PUBLIC_API_URL`
- Request Interceptor: Adds `Authorization: Bearer {token}` header
- Response Interceptor: 
  - 401 response → Clear token, redirect to /login
  - Other errors → Pass through

## Data Transfer Objects (DTOs)

### LoginRequestDto
```typescript
{
  email: string;    // Valid email format
  password: string; // Min 6 characters
}
```

### LoginResponseDto
```typescript
{
  token: string;      // JWT token for subsequent requests
  tokenType: string;  // "Bearer"
  email: string;      // User email
  name: string;       // User full name
  role: string;       // User role (e.g., "user", "admin")
  expiresIn: number;  // Token expiration in seconds
}
```

## Integration Pattern (Example)

```typescript
// In components or use cases
const loginUseCase = new LoginUseCase(new AuthRepositoryImpl());
await loginUseCase.login(email, password);
// Token automatically stored in cookie
```

## Error Codes

| Code | Message | Handling |
|------|---------|----------|
| 401 | Invalid credentials | Show "Invalid email or password" |
| 400 | Bad request | Show "Please check your input" |
| 500 | Server error | Show "Server error. Try again later." |
| Network | Connection failed | Show "Unable to connect. Try again." |
