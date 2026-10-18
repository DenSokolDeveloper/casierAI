import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';
import type { UserRole } from '../models/auth.models';

export const roleGuard = (...allowedRoles: UserRole[]): CanActivateFn => {
  return () => {
    const user = inject(AuthService).currentUser();
    if (user && allowedRoles.includes(user.role)) {
      return true;
    }
    return inject(Router).createUrlTree(['/']);
  };
};
