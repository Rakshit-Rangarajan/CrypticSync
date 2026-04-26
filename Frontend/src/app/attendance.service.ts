import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface User {
  id: number;
  employeeId: string;
  name: string;
  email: string;
  department?: string;
  designation?: string;
  role: string;
  managerId?: number;
}

export interface AttendanceRecord {
  id: number;
  userId: number;
  date: string;
  punchIn?: string;
  punchOut?: string;
  totalHours?: number;
  status: string;
}

@Injectable({
  providedIn: 'root'
})
export class AttendanceService {
  private http = inject(HttpClient);
  private apiUrl = 'http://localhost:8000/api';

  private getHeaders() {
    const token = localStorage.getItem('token');
    return new HttpHeaders({
      'Authorization': `Bearer ${token}`
    });
  }

  getUsers(): Observable<User[]> {
    return this.http.get<User[]>(`${this.apiUrl}/users`, { headers: this.getHeaders() });
  }

  getAttendance(date?: string): Observable<AttendanceRecord[]> {
    const url = date ? `${this.apiUrl}/attendance?date=${date}` : `${this.apiUrl}/attendance`;
    return this.http.get<AttendanceRecord[]>(url, { headers: this.getHeaders() });
  }

  markAttendance(userId: number, record: Partial<AttendanceRecord>): Observable<AttendanceRecord> {
    return this.http.post<AttendanceRecord>(`${this.apiUrl}/attendance`, { ...record, userId }, { headers: this.getHeaders() });
  }
}
