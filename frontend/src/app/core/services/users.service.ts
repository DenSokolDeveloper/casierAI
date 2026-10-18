import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { CreateUserPayload, ManagedUser } from '../models/user.models';

@Injectable({ providedIn: 'root' })
export class UsersService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiBaseUrl}/users`;

  list(): Observable<ManagedUser[]> {
    return this.http.get<ManagedUser[]>(this.baseUrl);
  }

  create(payload: CreateUserPayload): Observable<ManagedUser> {
    return this.http.post<ManagedUser>(this.baseUrl, payload);
  }

  remove(id: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${id}`);
  }
}
