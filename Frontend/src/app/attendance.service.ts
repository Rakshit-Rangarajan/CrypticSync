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
  role: 'EMPLOYEE' | 'TEAM_LEAD' | 'MANAGER' | 'ADMIN' | 'CTO' | 'SUPER_ADMIN';
  managerId?: number;
  managerName?: string;
  teamName?: string;
  isActive: boolean;
  password?: string;
}

export interface AttendanceRecord {
  id: number;
  userId: number;
  date: string;
  punchIn?: string;
  punchOut?: string;
  totalHours?: number;
  totalWorkedSeconds: number;
  isPaused: boolean;
  lastActionTime?: string;
  status: 'PRESENT' | 'ABSENT' | 'HOLIDAY' | 'LEAVE' | 'INCOMPLETE' | 'NOT_RECORDED' | 'WFH';
  regStatus: 'NONE' | 'PENDING' | 'APPROVED' | 'REJECTED';
  reason?: string;
}

export interface LeaveRecord {
  id: number;
  userId: number;
  leaveType: string;
  startDate: string;
  endDate: string;
  duration?: 'FULL_DAY' | 'HALF_DAY_MORNING' | 'HALF_DAY_EVENING';
  reason?: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  approvedBy?: number;
  createdAt: string;
}

export interface HolidayRecord {
  id: number;
  holidayName: string;
  date: string;
  description?: string;
  isOptional: boolean;
}

export interface LeaveBalance {
  id: number;
  userId: number;
  leaveType: string;
  totalDays: number;
  usedDays: number;
}

export interface AppNotification {
  id: number;
  userId: number;
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
  isRead: boolean;
  createdAt: string;
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

  getHolidays(year: number, month?: number): Observable<HolidayRecord[]> {
    let url = `${this.apiUrl}/holidays?year=${year}`;
    if (month) url += `&month=${month}`;
    return this.http.get<HolidayRecord[]>(url, { headers: this.getHeaders() });
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

  getUserLeaveBalances(userId: number): Observable<LeaveBalance[]> {
    return this.http.get<LeaveBalance[]>(`${this.apiUrl}/leave-balances/${userId}`, { headers: this.getHeaders() });
  }

  updateLeaveBalances(userId: number, updates: { leave_type: string; total_days: number }[]): Observable<LeaveBalance[]> {
    return this.http.put<LeaveBalance[]>(`${this.apiUrl}/leave-balances/${userId}`, updates, { headers: this.getHeaders() });
  }

  broadcastNotification(data: { title: string; message: string; type: string; target_type: string; target_value?: string }): Observable<any> {
    return this.http.post(`${this.apiUrl}/notifications/broadcast`, data, { headers: this.getHeaders() });
  }

  punchIn(): Observable<AttendanceRecord> {
    return this.http.post<AttendanceRecord>(`${this.apiUrl}/attendance/punch-in`, {}, { headers: this.getHeaders() });
  }

  // Admin Methods
  createUser(user: Partial<User>): Observable<User> {
    return this.http.post<User>(`${this.apiUrl}/users`, user, { headers: this.getHeaders() });
  }

  updateUser(userId: number, user: Partial<User>): Observable<User> {
    return this.http.put<User>(`${this.apiUrl}/users/${userId}`, user, { headers: this.getHeaders() });
  }

  deleteUser(userId: number): Observable<any> {
    return this.http.delete(`${this.apiUrl}/users/${userId}`, { headers: this.getHeaders() });
  }

  getTeams(): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/teams`, { headers: this.getHeaders() });
  }

  createTeam(team: any): Observable<any> {
    return this.http.post(`${this.apiUrl}/teams`, team, { headers: this.getHeaders() });
  }

  deleteTeam(teamId: number): Observable<any> {
    return this.http.delete(`${this.apiUrl}/teams/${teamId}`, { headers: this.getHeaders() });
  }

  createHoliday(holiday: Partial<HolidayRecord>): Observable<HolidayRecord> {
    return this.http.post<HolidayRecord>(`${this.apiUrl}/holidays`, holiday, { headers: this.getHeaders() });
  }

  deleteHoliday(holidayId: number): Observable<any> {
    return this.http.delete(`${this.apiUrl}/holidays/${holidayId}`, { headers: this.getHeaders() });
  }

  approveRegularization(attendanceId: number): Observable<any> {
    return this.http.post(`${this.apiUrl}/attendance/${attendanceId}/approve`, {}, { headers: this.getHeaders() });
  }

  rejectRegularization(attendanceId: number): Observable<any> {
    return this.http.post(`${this.apiUrl}/attendance/${attendanceId}/reject`, {}, { headers: this.getHeaders() });
  }

  getManagerPending(): Observable<{ leaves: any[], regularizations: any[] }> {
    return this.http.get<{ leaves: any[], regularizations: any[] }>(`${this.apiUrl}/manager/pending`, { headers: this.getHeaders() });
  }

  punchOut(): Observable<AttendanceRecord> {
    return this.http.post<AttendanceRecord>(`${this.apiUrl}/attendance/punch-out`, {}, { headers: this.getHeaders() });
  }

  pause(): Observable<AttendanceRecord> {
    return this.http.post<AttendanceRecord>(`${this.apiUrl}/attendance/pause`, {}, { headers: this.getHeaders() });
  }

  resume(): Observable<AttendanceRecord> {
    return this.http.post<AttendanceRecord>(`${this.apiUrl}/attendance/resume`, {}, { headers: this.getHeaders() });
  }

  getLeaveBalances(): Observable<LeaveBalance[]> {
    return this.http.get<LeaveBalance[]>(`${this.apiUrl}/leave-balances`, { headers: this.getHeaders() });
  }

  getNotifications(): Observable<AppNotification[]> {
    return this.http.get<AppNotification[]>(`${this.apiUrl}/notifications`, { headers: this.getHeaders() });
  }

  markNotificationRead(id: number): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/notifications/${id}/read`, {}, { headers: this.getHeaders() });
  }

  submitContact(data: { name: string; email: string; rating: number; message: string }): Observable<any> {
    return this.http.post(`${this.apiUrl}/contact`, data);
  }
}