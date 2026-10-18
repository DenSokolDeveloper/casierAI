import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { TransactionItemPayload, TransactionResponse } from '../models/pos.models';

@Injectable({ providedIn: 'root' })
export class TransactionsService {
  private readonly http = inject(HttpClient);
  private readonly url = `${environment.apiBaseUrl}/transactions`;

  create(items: TransactionItemPayload[]): Observable<TransactionResponse> {
    return this.http.post<TransactionResponse>(this.url, { items });
  }
}
