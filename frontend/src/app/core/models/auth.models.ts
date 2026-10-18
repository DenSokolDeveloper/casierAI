export type UserRole = 'owner' | 'cashier';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
}

export interface LoginResponse {
  accessToken: string;
  user: AuthUser;
}

export interface RegisterPayload {
  shopName: string;
  name: string;
  email: string;
  password: string;
}
