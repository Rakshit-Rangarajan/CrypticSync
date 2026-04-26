import { Component, inject, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AttendanceService, Employee, AttendanceRecord } from '../attendance.service';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.css',
})
export class DashboardComponent implements OnInit {
  private api = inject(AttendanceService);
  
  employees = signal<Employee[]>([]);
  attendance = signal<AttendanceRecord[]>([]);
  isLoading = signal(false);
  
  selectedDate = signal(new Date().toISOString().split('T')[0]);

  // Computed Stats
  totalEmployees = computed(() => this.employees().length);
  presentCount = computed(() => this.attendance().filter(a => a.status === 'Present').length);
  absentCount = computed(() => this.totalEmployees() - this.presentCount());
  
  ngOnInit() {
    this.loadData();
  }

  async loadData() {
    this.isLoading.set(true);
    this.api.getEmployees().subscribe(data => this.employees.set(data));
    this.api.getAttendance(this.selectedDate()).subscribe(data => {
      this.attendance.set(data);
      this.isLoading.set(false);
    });
  }

  isEmployeePresent(id: number) {
    return this.attendance().some(a => a.employeeId === id && a.status === 'Present');
  }

  toggleAttendance(employee: Employee) {
    const present = this.isEmployeePresent(employee.id);
    const newStatus = present ? 'Absent' : 'Present';
    
    this.api.markAttendance(employee.id, {
      date: this.selectedDate(),
      status: newStatus,
      checkIn: newStatus === 'Present' ? new Date().toISOString() : undefined
    }).subscribe(() => this.loadData());
  }

  addEmployee() {
    const name = prompt("Enter Employee Name:");
    if (!name) return;
    this.api.createEmployee({ name, department: 'General', email: `${name.toLowerCase()}@company.com` })
      .subscribe(() => this.loadData());
  }
}
