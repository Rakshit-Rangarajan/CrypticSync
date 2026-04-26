import { Component, inject, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AttendanceService, User, HolidayRecord } from '../attendance.service';

@Component({
  selector: 'app-admin',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './admin.html',
  styleUrl: './admin.css'
})
export class AdminComponent implements OnInit {
  private api = inject(AttendanceService);
  
  users = signal<User[]>([]);
  holidays = signal<HolidayRecord[]>([]);
  activeTab = signal<'users' | 'org' | 'logs'>('users');
  
  searchTerm = signal('');
  showUserModal = signal(false);

  filteredUsers = computed(() => {
    const term = this.searchTerm().toLowerCase();
    return this.users().filter(u => 
      u.name.toLowerCase().includes(term) || 
      u.email.toLowerCase().includes(term) ||
      u.employeeId.toLowerCase().includes(term)
    );
  });

  ngOnInit() {
    this.loadUsers();
    this.loadHolidays();
  }

  loadUsers() {
    this.api.getUsers().subscribe(data => this.users.set(data));
  }

  loadHolidays() {
    this.api.getHolidays(new Date().getFullYear()).subscribe(data => this.holidays.set(data));
  }

  deleteUser(userId: number) {
    if (confirm('Are you sure you want to delete this user? This action cannot be undone.')) {
      // API call to delete
      alert('User deleted successfully');
      this.loadUsers();
    }
  }

  toggleUserStatus(user: User) {
    // API call to toggle isActive
    user.isActive = !user.isActive;
    alert(`User ${user.isActive ? 'activated' : 'deactivated'}`);
  }
}
