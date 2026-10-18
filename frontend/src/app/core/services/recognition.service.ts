import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { RecognitionCandidate } from '../models/pos.models';

@Injectable({ providedIn: 'root' })
export class RecognitionService {
  private readonly http = inject(HttpClient);
  private readonly url = `${environment.apiBaseUrl}/recognize`;

  recognize(photo: Blob): Observable<{ candidates: RecognitionCandidate[] }> {
    const formData = new FormData();
    formData.append('photo', photo, 'capture.jpg');
    return this.http.post<{ candidates: RecognitionCandidate[] }>(this.url, formData);
  }
}
