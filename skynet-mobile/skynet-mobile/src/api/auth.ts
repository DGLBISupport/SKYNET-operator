import { apiPost } from './client';
import { AuthUser } from '../types';

interface LoginResponse {
  success: boolean;
  user?: AuthUser;
  error?: string;
}

export function login(email: string, password: string) {
  return apiPost<LoginResponse>('/api/auth/login', { email, password });
}
