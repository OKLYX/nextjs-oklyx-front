export interface User {
  id: number;
  email: string;
  name: string;
  role: 'GUEST' | 'USER' | 'ADMIN';
  createdAt: string;
  updatedAt: string;
}
