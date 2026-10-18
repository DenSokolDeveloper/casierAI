import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';
import { roleGuard } from './core/guards/role.guard';

export const routes: Routes = [
  {
    path: 'login',
    loadComponent: () => import('./pages/login/login.component').then((m) => m.LoginComponent),
  },
  {
    path: 'register',
    loadComponent: () =>
      import('./pages/register/register.component').then((m) => m.RegisterComponent),
  },
  {
    path: '',
    canActivate: [authGuard],
    loadComponent: () => import('./pages/pos/pos.component').then((m) => m.PosComponent),
  },
  {
    path: 'admin',
    canActivate: [authGuard, roleGuard('owner')],
    loadComponent: () => import('./pages/admin/admin.component').then((m) => m.AdminComponent),
    children: [
      {
        path: 'dashboard',
        loadComponent: () =>
          import('./pages/admin/dashboard/dashboard.component').then(
            (m) => m.DashboardComponent,
          ),
      },
      {
        path: 'products',
        loadComponent: () =>
          import('./pages/admin/products/products.component').then((m) => m.ProductsComponent),
      },
      {
        path: 'categories',
        loadComponent: () =>
          import('./pages/admin/categories/categories.component').then(
            (m) => m.CategoriesComponent,
          ),
      },
      {
        path: 'users',
        loadComponent: () =>
          import('./pages/admin/users/users.component').then((m) => m.UsersComponent),
      },
      {
        path: 'import',
        loadComponent: () =>
          import('./pages/admin/import/import.component').then((m) => m.ImportComponent),
      },
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
    ],
  },
  { path: '**', redirectTo: '' },
];
