import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-register',
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './register.component.html',
  styleUrl: './register.component.scss',
})
export class RegisterComponent {
  private readonly fb = inject(FormBuilder);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  protected readonly errorMessage = signal<string | null>(null);
  protected readonly isSubmitting = signal(false);

  protected readonly form = this.fb.group({
    shopName: ['', [Validators.required]],
    name: ['', [Validators.required]],
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(8)]],
  });

  constructor() {
    if (this.authService.isAuthenticated()) {
      void this.router.navigateByUrl('/');
    }
  }

  submit(): void {
    if (this.form.invalid || this.isSubmitting()) {
      return;
    }

    const { shopName, name, email, password } = this.form.getRawValue();
    this.errorMessage.set(null);
    this.isSubmitting.set(true);

    this.authService.register({ shopName: shopName!, name: name!, email: email!, password: password! }).subscribe({
      next: () => {
        this.isSubmitting.set(false);
        void this.router.navigateByUrl('/');
      },
      error: (err) => {
        this.isSubmitting.set(false);
        this.errorMessage.set(
          err?.status === 409
            ? 'Пользователь с таким email уже существует'
            : 'Не удалось зарегистрировать магазин',
        );
      },
    });
  }
}
