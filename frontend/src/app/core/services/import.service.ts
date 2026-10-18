import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ImportCommitResult, ImportPreviewResult, ImportPreviewRow } from '../models/import.models';

@Injectable({ providedIn: 'root' })
export class ImportService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiBaseUrl}/import`;

  preview(file: File): Observable<ImportPreviewResult> {
    const formData = new FormData();
    formData.append('file', file);
    return this.http.post<ImportPreviewResult>(`${this.baseUrl}/preview`, formData);
  }

  commit(rows: ImportPreviewRow[]): Observable<ImportCommitResult> {
    return this.http.post<ImportCommitResult>(`${this.baseUrl}/commit`, { rows });
  }
}
