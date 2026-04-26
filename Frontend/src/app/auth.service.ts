import { Injectable, signal } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Observable, tap, catchError, of } from 'rxjs';
import { Router } from '@angular/router';

export interface User {
  id: number;
  employeeId: string;
  name: string;
  email: string;
  department?: string;
  designation?: string;
  role: 'EMPLOYEE' | 'MANAGER' | 'ADMIN';
  isActive: boolean;
}

export interface TokenResponse {
  accessToken: string;
  tokenType: string;
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private apiUrl = 'http://localhost:8000/api';
  
  currentUser = signal<User | null>(null);
  isAuthenticated = signal<boolean>(false);

  constructor(private http: HttpClient, private router: Router) {
    this.checkInitialAuth();
  }

  private checkInitialAuth() {
    const token = localStorage.getItem('token');
    if (token) {
      this.fetchCurrentUser().subscribe({
        next: (user) => {
          this.currentUser.set(user);
          this.isAuthenticated.set(true);
        },
        error: () => {
          this.logout();
        }
      });
    }
  }

  login(username: string, password: string): Observable<TokenResponse> {
    const body = new HttpParams()
      .set('username', username)
      .set('password', password);

    const headers = new HttpHeaders({
      'Content-Type': 'application/x-www-form-urlencoded'
    });

    return this.http.post<TokenResponse>(`${this.apiUrl}/token`, body.toString(), { headers }).pipe(
      tap(response => {
        localStorage.setItem('token', response.accessToken);
        this.fetchCurrentUser().subscribe(user => {
          this.currentUser.set(user);
          this.isAuthenticated.set(true);
          this.router.navigate(['/dashboard']);
        });
      })
    );
  }

  fetchCurrentUser(): Observable<User> {
    const token = localStorage.getItem('token');
    const headers = new HttpHeaders({
      'Authorization': `Bearer ${token}`
    });
    return this.http.get<User>(`${this.apiUrl}/users/me`, { headers });
  }

  logout() {
    localStorage.removeItem('token');
    this.currentUser.set(null);
    this.isAuthenticated.set(false);
    this.router.navigate(['/login']);
  }

  hasRole(role: 'EMPLOYEE' | 'MANAGER' | 'ADMIN'): boolean {
    const user = this.currentUser();
    if (!user) return false;
    if (user.role === 'ADMIN') return true;
    return user.role === role;
  }
}
