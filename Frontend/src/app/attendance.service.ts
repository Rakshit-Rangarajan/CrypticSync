import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface Employee {
  id: number;
  name: string;
  department: string;
  email: string;
  attendance?: AttendanceRecord[];
}

export interface AttendanceRecord {
  id: number;
  employeeId: number;
  date: string;
  status: string;
  checkIn?: string;
  checkOut?: string;
}

@Injectable({
  providedIn: 'root'
})
export class AttendanceService {
  private http = inject(HttpClient);
  private apiUrl = 'http://localhost:8000/api';

  getEmployees(): Observable<Employee[]> {
    return this.http.get<Employee[]>(`${this.apiUrl}/employees`);
  }

  createEmployee(employee: Partial<Employee>): Observable<Employee> {
    return this.http.post<Employee>(`${this.apiUrl}/employees`, employee);
  }

  getAttendance(date?: string): Observable<AttendanceRecord[]> {
    const url = date ? `${this.apiUrl}/attendance?date=${date}` : `${this.apiUrl}/attendance`;
    return this.http.get<AttendanceRecord[]>(url);
  }

  markAttendance(employeeId: number, record: Partial<AttendanceRecord>): Observable<AttendanceRecord> {
    return this.http.post<AttendanceRecord>(`${this.apiUrl}/attendance?employee_id=${employeeId}`, record);
  }
}
