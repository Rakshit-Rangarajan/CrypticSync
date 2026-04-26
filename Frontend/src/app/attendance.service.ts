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
  role: 'EMPLOYEE' | 'MANAGER' | 'ADMIN';
  managerId?: number;
  isActive: boolean;
}

export interface AttendanceRecord {
  id: number;
  userId: number;
  date: string;
  punchIn?: string;
  punchOut?: string;
  totalHours?: number;
  status: 'PRESENT' | 'ABSENT' | 'HOLIDAY' | 'LEAVE' | 'INCOMPLETE' | 'NOT_RECORDED';
}

export interface LeaveRecord {
  id: number;
  userId: number;
  leaveType: string;
  startDate: string;
  endDate: string;
  reason?: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  approvedBy?: number;
  createdAt: string;
}

export interface HolidayRecord {
  id: number;
  name: string;
  date: string;
  description?: string;
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

  getMonthlyAttendance(userId: number, year: number, month: number): Observable<AttendanceRecord[]> {
    return this.http.get<AttendanceRecord[]>(
      `${this.apiUrl}/attendance/${userId}/monthly?year=${year}&month=${month}`,
      { headers: this.getHeaders() }
    );
  }

  markAttendance(userId: number, record: Partial<AttendanceRecord>): Observable<AttendanceRecord> {
    return this.http.post<AttendanceRecord>(`${this.apiUrl}/attendance`, { ...record, userId }, { headers: this.getHeaders() });
  }

  getLeaveTypes(): Observable<string[]> {
    return this.http.get<string[]>(`${this.apiUrl}/leave-types`, { headers: this.getHeaders() });
  }

  getUserLeaves(userId: number): Observable<LeaveRecord[]> {
    return this.http.get<LeaveRecord[]>(`${this.apiUrl}/leaves?userId=${userId}`, { headers: this.getHeaders() });
  }

  getCurrentUserLeaves(): Observable<LeaveRecord[]> {
    return this.http.get<LeaveRecord[]>(`${this.apiUrl}/leaves/me`, { headers: this.getHeaders() });
  }

  getHolidays(year: number, month: number): Observable<HolidayRecord[]> {
    return this.http.get<HolidayRecord[]>(
      `${this.apiUrl}/holidays?year=${year}&month=${month}`,
      { headers: this.getHeaders() }
    );
  }

  getReportees(): Observable<User[]> {
    return this.http.get<User[]>(`${this.apiUrl}/reportees`, { headers: this.getHeaders() });
  }

  getReporteesAttendance(weekStartDate: string): Observable<{ user: User; attendance: AttendanceRecord[] }[]> {
    return this.http.get<{ user: User; attendance: AttendanceRecord[] }[]>(
      `${this.apiUrl}/reportees/attendance?weekStart=${weekStartDate}`,
      { headers: this.getHeaders() }
    );
  }

  requestLeave(leave: Partial<LeaveRecord>): Observable<LeaveRecord> {
    return this.http.post<LeaveRecord>(`${this.apiUrl}/leaves`, leave, { headers: this.getHeaders() });
  }
}