import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { CreateProductPayload, Product, UpdateProductPayload } from '../models/catalog.models';

@Injectable({ providedIn: 'root' })
export class ProductsService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiBaseUrl}/products`;

  list(): Observable<Product[]> {
    return this.http.get<Product[]>(this.baseUrl);
  }

  create(payload: CreateProductPayload): Observable<Product> {
    return this.http.post<Product>(this.baseUrl, payload);
  }

  update(id: string, payload: UpdateProductPayload): Observable<Product> {
    return this.http.patch<Product>(`${this.baseUrl}/${id}`, payload);
  }

  remove(id: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${id}`);
  }

  uploadPhoto(id: string, photo: File): Observable<Product> {
    const formData = new FormData();
    formData.append('photo', photo);
    return this.http.post<Product>(`${this.baseUrl}/${id}/photo`, formData);
  }

  removePhoto(id: string): Observable<Product> {
    return this.http.delete<Product>(`${this.baseUrl}/${id}/photo`);
  }
}
