import { Injectable, computed, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { Observable, tap } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AuthUser, LoginResponse } from '../models/auth.models';

const TOKEN_KEY = 'casierai_token';
const USER_KEY = 'casierai_user';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly tokenSignal = signal<string | null>(this.readStorage(TOKEN_KEY));
  private readonly userSignal = signal<AuthUser | null>(this.readStoredUser());

  readonly token = computed(() => this.tokenSignal());
  readonly currentUser = computed(() => this.userSignal());
  readonly isAuthenticated = computed(() => this.tokenSignal() !== null);

  constructor(
    private readonly http: HttpClient,
    private readonly router: Router,
  ) {}

  login(email: string, password: string): Observable<LoginResponse> {
    return this.http
      .post<LoginResponse>(`${environment.apiBaseUrl}/auth/login`, { email, password })
      .pipe(
        tap((response) => {
          this.tokenSignal.set(response.accessToken);
          this.userSignal.set(response.user);
          this.writeStorage(TOKEN_KEY, response.accessToken);
          this.writeStorage(USER_KEY, JSON.stringify(response.user));
        }),
      );
  }

  logout(): void {
    this.tokenSignal.set(null);
    this.userSignal.set(null);
    this.removeStorage(TOKEN_KEY);
    this.removeStorage(USER_KEY);
    void this.router.navigateByUrl('/login');
  }

  private readStoredUser(): AuthUser | null {
    const raw = this.readStorage(USER_KEY);
    if (!raw) {
      return null;
    }
    try {
      return JSON.parse(raw) as AuthUser;
    } catch {
      return null;
    }
  }

  private readStorage(key: string): string | null {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  }

  private writeStorage(key: string, value: string): void {
    try {
      localStorage.setItem(key, value);
    } catch {
      // Storage unavailable (private mode, blocked site data) - session just won't persist.
    }
  }

  private removeStorage(key: string): void {
    try {
      localStorage.removeItem(key);
    } catch {
      // Ignore - nothing to clean up if storage was never written.
    }
  }
}
