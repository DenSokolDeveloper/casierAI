import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Category, CreateCategoryPayload, UpdateCategoryPayload } from '../models/catalog.models';

@Injectable({ providedIn: 'root' })
export class CategoriesService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiBaseUrl}/categories`;

  list(): Observable<Category[]> {
    return this.http.get<Category[]>(this.baseUrl);
  }

  create(payload: CreateCategoryPayload): Observable<Category> {
    return this.http.post<Category>(this.baseUrl, payload);
  }

  update(id: string, payload: UpdateCategoryPayload): Observable<Category> {
    return this.http.patch<Category>(`${this.baseUrl}/${id}`, payload);
  }

  remove(id: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${id}`);
  }

  uploadPhoto(id: string, photo: File): Observable<Category> {
    const formData = new FormData();
    formData.append('photo', photo);
    return this.http.post<Category>(`${this.baseUrl}/${id}/photo`, formData);
  }

  removePhoto(id: string): Observable<Category> {
    return this.http.delete<Category>(`${this.baseUrl}/${id}/photo`);
  }
}
