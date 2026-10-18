import { Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTableModule } from '@angular/material/table';
import { MatChipsModule } from '@angular/material/chips';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { UsersService } from '../../../core/services/users.service';
import { AuthService } from '../../../core/services/auth.service';
import { ManagedUser } from '../../../core/models/user.models';

@Component({
  selector: 'app-admin-users',
  imports: [
    ReactiveFormsModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
    MatIconModule,
    MatTableModule,
    MatChipsModule,
    MatProgressSpinnerModule,
    MatTooltipModule,
    TranslatePipe,
  ],
  templateUrl: './users.component.html',
  styleUrl: './users.component.scss',
})
export class UsersComponent implements OnInit {
  private readonly usersService = inject(UsersService);
  protected readonly authService = inject(AuthService);
  private readonly fb = inject(FormBuilder);
  private readonly translate = inject(TranslateService);

  protected readonly users = signal<ManagedUser[]>([]);
  protected readonly isLoading = signal(false);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly isCreating = signal(false);
  protected readonly displayedColumns = ['name', 'email', 'role', 'actions'];

  protected readonly form = this.fb.group({
    name: ['', Validators.required],
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(8)]],
    role: ['cashier' as 'owner' | 'cashier', Validators.required],
  });

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.isLoading.set(true);
    this.usersService.list().subscribe({
      next: (users) => {
        this.users.set(users);
        this.isLoading.set(false);
      },
      error: () => {
        this.errorMessage.set('admin.users.loadError');
        this.isLoading.set(false);
      },
    });
  }

  submit(): void {
    if (this.form.invalid || this.isCreating()) {
      return;
    }
    const payload = this.form.getRawValue() as {
      name: string;
      email: string;
      password: string;
      role: 'owner' | 'cashier';
    };
    this.errorMessage.set(null);
    this.isCreating.set(true);

    this.usersService.create(payload).subscribe({
      next: () => {
        this.isCreating.set(false);
        this.form.reset({ name: '', email: '', password: '', role: 'cashier' });
        this.load();
      },
      error: (err) => {
        this.isCreating.set(false);
        this.errorMessage.set(
          err?.status === 409 ? 'admin.users.errorConflict' : 'admin.users.createError',
        );
      },
    });
  }

  remove(user: ManagedUser): void {
    if (user._id === this.authService.currentUser()?.id) {
      this.errorMessage.set('admin.users.selfDeleteError');
      return;
    }
    const confirmMessage = this.translate.instant('admin.users.confirmDelete', {
      name: user.name,
      email: user.email,
    });
    if (!confirm(confirmMessage)) {
      return;
    }
    this.usersService.remove(user._id).subscribe({
      next: () => this.load(),
      error: () => this.errorMessage.set('admin.users.deleteError'),
    });
  }
}
