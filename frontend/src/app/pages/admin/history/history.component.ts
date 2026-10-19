import { Component, OnInit, inject, signal } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { TranslatePipe } from '@ngx-translate/core';
import { TransactionsService } from '../../../core/services/transactions.service';
import { Transaction } from '../../../core/models/pos.models';
import { downloadCsv } from '../../../core/utils/csv.util';

@Component({
  selector: 'app-admin-history',
  imports: [
    DatePipe,
    DecimalPipe,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    TranslatePipe,
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

  ngOnInit(): void {
    this.load();
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
    const rows = this.transactions().flatMap((transaction) => {
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
