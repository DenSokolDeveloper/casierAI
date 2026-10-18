import type { UserRole } from './auth.models';

export interface ManagedUser {
  _id: string;
  email: string;
  name: string;
  role: UserRole;
  active: boolean;
}

export interface CreateUserPayload {
  email: string;
  password: string;
  name: string;
  role: UserRole;
}
