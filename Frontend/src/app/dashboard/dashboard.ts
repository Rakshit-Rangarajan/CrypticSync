import { Component, inject, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AttendanceService, User, AttendanceRecord } from '../attendance.service';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.css',
})
export class DashboardComponent implements OnInit {
  private api = inject(AttendanceService);
  
  users = signal<User[]>([]);
  attendance = signal<AttendanceRecord[]>([]);
  isLoading = signal(false);
  
  selectedDate = signal(new Date().toISOString().split('T')[0]);

  // Computed Stats
  totalUsers = computed(() => this.users().length);
  presentCount = computed(() => this.attendance().filter(a => a.status === 'PRESENT').length);
  absentCount = computed(() => this.totalUsers() - this.presentCount());
  
  ngOnInit() {
    this.loadData();
  }

  async loadData() {
    this.isLoading.set(true);
    this.api.getUsers().subscribe(data => this.users.set(data));
    this.api.getAttendance(this.selectedDate()).subscribe(data => {
      this.attendance.set(data);
      this.isLoading.set(false);
    });
  }

  isUserPresent(id: number) {
    return this.attendance().some(a => a.userId === id && a.status === 'PRESENT');
  }

  toggleAttendance(user: User) {
    const present = this.isUserPresent(user.id);
    const newStatus = present ? 'ABSENT' : 'PRESENT';
    
    this.api.markAttendance(user.id, {
      date: this.selectedDate(),
      status: newStatus,
      punchIn: newStatus === 'PRESENT' ? new Date().toISOString() : undefined
    }).subscribe(() => this.loadData());
  }

  addEmployee() {
    alert("User registration is managed by the Admin.");
  }
}
