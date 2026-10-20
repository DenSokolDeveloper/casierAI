import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { TranslatePipe } from '@ngx-translate/core';
import { TransactionsService } from '../../../core/services/transactions.service';
import { Transaction } from '../../../core/models/pos.models';
import { downloadCsv } from '../../../core/utils/csv.util';
import { UnitLabelPipe } from '../../../core/pipes/unit-label.pipe';

@Component({
  selector: 'app-admin-history',
  imports: [
    DatePipe,
    DecimalPipe,
    FormsModule,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressSpinnerModule,
    TranslatePipe,
    UnitLabelPipe,
  ],
  templateUrl: './history.component.html',
  styleUrl: './history.component.scss',
})
export class HistoryComponent implements OnInit {
  private readonly transactionsService = inject(TransactionsService);

  protected readonly transactions = signal<Transaction[]>([]);
  protected readonly isLoading = signal(false);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly expandedId = signal<string | null>(null);

  protected readonly fromDate = signal('');
  protected readonly toDate = signal('');

  protected readonly filteredTransactions = computed(() => {
    const from = this.fromDate();
    const to = this.toDate();
    if (!from && !to) {
      return this.transactions();
    }
    const fromTime = from ? new Date(from).getTime() : -Infinity;
    // End-of-day so the "to" date itself is included, not excluded at midnight.
    const toTime = to ? new Date(to).getTime() + 24 * 60 * 60 * 1000 - 1 : Infinity;
    return this.transactions().filter((tx) => {
      const time = new Date(tx.createdAt).getTime();
      return time >= fromTime && time <= toTime;
    });
  });

  ngOnInit(): void {
    this.load();
  }

  setFromDate(value: string): void {
    this.fromDate.set(value);
  }

  setToDate(value: string): void {
    this.toDate.set(value);
  }

  clearDateFilter(): void {
    this.fromDate.set('');
    this.toDate.set('');
  }

  load(): void {
    this.isLoading.set(true);
    this.errorMessage.set(null);
    this.transactionsService.list().subscribe({
      next: (transactions) => {
        this.transactions.set(transactions);
        this.isLoading.set(false);
      },
      error: () => {
        this.errorMessage.set('admin.history.loadError');
        this.isLoading.set(false);
      },
    });
  }

  toggle(id: string): void {
    this.expandedId.set(this.expandedId() === id ? null : id);
  }

  cashierName(transaction: Transaction): string {
    const cashier = transaction.cashierId;
    return typeof cashier === 'string' ? cashier : cashier.name;
  }

  exportCsv(): void {
    const headers = [
      'Date',
      'Cashier',
      'Product',
      'Qty',
      'Unit',
      'Unit price',
      'Line total',
      'Transaction total',
    ];
    const rows = this.filteredTransactions().flatMap((transaction) => {
      const date = new Date(transaction.createdAt).toISOString().slice(0, 16).replace('T', ' ');
      const cashier = this.cashierName(transaction);
      return transaction.items.map((item) => [
        date,
        cashier,
        item.name,
        item.qty,
        item.unit,
        item.unitPrice,
        item.lineTotal,
        transaction.total,
      ]);
    });
    downloadCsv('sales-history.csv', headers, rows);
  }
}
