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
  role: 'EMPLOYEE' | 'TEAM_LEAD' | 'MANAGER' | 'ADMIN' | 'CTO' | 'SUPER_ADMIN';
  managerId?: number;
  managerName?: string;
  teamName?: string;
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
  private apiUrl = window.location.hostname === 'localhost' 
    ? 'http://localhost:8000/api' 
    : 'https://api.rakshitr.co.in/CrypticSync/api';
  
  currentUser = signal<User | null>(null);
  isAuthenticated = signal<boolean>(false);

  constructor(private http: HttpClient, private router: Router) {
    this.checkInitialAuth();
  }

  private checkInitialAuth() {
    const token = localStorage.getItem('token');
    if (token) {
      // Optimistically assume authenticated if token exists to prevent logout on refresh
      this.isAuthenticated.set(true);
      
      this.fetchCurrentUser().subscribe({
        next: (user) => {
          this.currentUser.set(user);
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

  forgotPassword(email: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/auth/forgot-password`, { email });
  }

  resetPassword(token: string, new_password: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/auth/reset-password`, { token, new_password });
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

  hasRole(role: string): boolean {
    const user = this.currentUser();
    if (!user) return false;
    if (user.role === 'SUPER_ADMIN' || user.role === 'ADMIN') return true;
    return user.role === role;
  }
}
