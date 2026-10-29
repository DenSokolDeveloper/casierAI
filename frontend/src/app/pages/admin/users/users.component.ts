import { Component, OnInit, ViewChild, inject, signal } from '@angular/core';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { SelectionModel } from '@angular/cdk/collections';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatTableModule, MatTableDataSource } from '@angular/material/table';
import { MatChipsModule } from '@angular/material/chips';
import { MatSort, MatSortModule, Sort } from '@angular/material/sort';
import { MatPaginator, MatPaginatorIntl, MatPaginatorModule } from '@angular/material/paginator';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { DatePipe } from '@angular/common';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { UsersService } from '../../../core/services/users.service';
import { AuthService } from '../../../core/services/auth.service';
import { ManagedUser } from '../../../core/models/user.models';
import { UserRole } from '../../../core/models/auth.models';
import { TranslatedPaginatorIntl } from '../../../core/services/translated-paginator-intl.service';

@Component({
  selector: 'app-admin-users',
  imports: [
    FormsModule,
    ReactiveFormsModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
    MatIconModule,
    MatCheckboxModule,
    MatTableModule,
    MatChipsModule,
    MatSortModule,
    MatPaginatorModule,
    MatProgressSpinnerModule,
    MatTooltipModule,
    DatePipe,
    TranslatePipe,
  ],
  providers: [{ provide: MatPaginatorIntl, useClass: TranslatedPaginatorIntl }],
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
  protected readonly isSaving = signal(false);
  protected readonly editingId = signal<string | null>(null);
  protected readonly showDialog = signal(false);
  protected readonly searchTerm = signal('');

  protected readonly displayedColumns = ['select', 'name', 'email', 'role', 'createdAt', 'actions'];
  protected readonly dataSource = new MatTableDataSource<ManagedUser>([]);
  protected readonly selection = new SelectionModel<string>(true, []);

  protected readonly form = this.fb.group({
    name: ['', Validators.required],
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(8)]],
    role: ['cashier' as UserRole, Validators.required],
  });

  @ViewChild(MatPaginator) set paginator(value: MatPaginator) {
    this.dataSource.paginator = value ?? null;
  }

  @ViewChild(MatSort) set sort(value: MatSort) {
    this.dataSource.sort = value ?? null;
  }

  constructor() {
    this.dataSource.filterPredicate = (user, filter) =>
      user.name.toLowerCase().includes(filter) || user.email.toLowerCase().includes(filter);
  }

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.isLoading.set(true);
    this.usersService.list().subscribe({
      next: (users) => {
        this.users.set(users);
        this.dataSource.data = users;
        this.selection.clear();
        this.isLoading.set(false);
      },
      error: () => {
        this.errorMessage.set('admin.users.loadError');
        this.isLoading.set(false);
      },
    });
  }

  protected onSearchChange(term: string): void {
    this.searchTerm.set(term);
    this.dataSource.filter = term.trim().toLowerCase();
    if (this.dataSource.paginator) {
      this.dataSource.paginator.firstPage();
    }
  }

  protected sortData(sort: Sort): void {
    void sort;
    if (this.dataSource.paginator) {
      this.dataSource.paginator.firstPage();
    }
  }

  // A plain method, not computed(): the underlying SelectionModel and
  // MatTableDataSource are not signals, so computed() would never see a
  // dependency change and the result would cache stale forever. A method
  // call is re-evaluated on every change-detection pass instead.
  protected allSelected(): boolean {
    const visible = this.dataSource.filteredData;
    return visible.length > 0 && visible.every((user) => this.selection.isSelected(user._id));
  }

  protected toggleAll(): void {
    if (this.allSelected()) {
      this.dataSource.filteredData.forEach((user) => this.selection.deselect(user._id));
    } else {
      this.dataSource.filteredData.forEach((user) => this.selection.select(user._id));
    }
  }

  protected toggleOne(userId: string): void {
    this.selection.toggle(userId);
  }

  protected deleteSelected(): void {
    const ids = this.selection.selected;
    if (ids.length === 0) {
      return;
    }
    const currentUserId = this.authService.currentUser()?.id;
    if (currentUserId && ids.includes(currentUserId)) {
      this.errorMessage.set('admin.users.selfDeleteError');
      return;
    }
    const confirmMessage = this.translate.instant('admin.users.confirmDeleteSelected', {
      count: ids.length,
    });
    if (!confirm(confirmMessage)) {
      return;
    }
    this.errorMessage.set(null);
    let remaining = ids.length;
    let hadError = false;
    ids.forEach((id) => {
      this.usersService.remove(id).subscribe({
        next: () => this.afterBulkDeleteOne(--remaining, hadError),
        error: () => {
          hadError = true;
          this.afterBulkDeleteOne(--remaining, hadError);
        },
      });
    });
  }

  private afterBulkDeleteOne(remaining: number, hadError: boolean): void {
    if (remaining > 0) {
      return;
    }
    if (hadError) {
      this.errorMessage.set('admin.users.deleteError');
    }
    this.load();
  }

  startCreate(): void {
    this.editingId.set(null);
    this.form.reset({ name: '', email: '', password: '', role: 'cashier' });
    this.form.get('password')!.setValidators([Validators.required, Validators.minLength(8)]);
    this.form.get('password')!.updateValueAndValidity();
    this.errorMessage.set(null);
    this.showDialog.set(true);
  }

  startEdit(user: ManagedUser): void {
    this.editingId.set(user._id);
    this.form.setValue({ name: user.name, email: user.email, password: '', role: user.role });
    // Leaving the password blank keeps the current one on edit.
    this.form.get('password')!.setValidators([Validators.minLength(8)]);
    this.form.get('password')!.updateValueAndValidity();
    this.errorMessage.set(null);
    this.showDialog.set(true);
  }

  cancelEdit(): void {
    this.editingId.set(null);
    this.showDialog.set(false);
    this.form.reset({ name: '', email: '', password: '', role: 'cashier' });
  }

  submit(): void {
    if (this.form.invalid || this.isSaving()) {
      return;
    }
    const raw = this.form.getRawValue();
    this.errorMessage.set(null);
    this.isSaving.set(true);

    const editingId = this.editingId();
    const request = editingId
      ? this.usersService.update(editingId, {
          name: raw.name!,
          email: raw.email!,
          role: raw.role!,
          password: raw.password || undefined,
        })
      : this.usersService.create({
          name: raw.name!,
          email: raw.email!,
          role: raw.role!,
          password: raw.password!,
        });

    request.subscribe({
      next: () => {
        this.isSaving.set(false);
        this.cancelEdit();
        this.load();
      },
      error: (err) => {
        this.isSaving.set(false);
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
