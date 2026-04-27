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
  showHolidayModal = signal(false);
  showDeptModal = signal(false);
  
  teams = signal<any[]>([]);

  newDept = signal({ name: '', department: '' });

  isEditMode = signal(false);
  editingUserId = signal<number | null>(null);

  newUser = signal<Partial<User>>({
    name: '',
    email: '',
    role: 'EMPLOYEE',
    designation: '',
    department: '',
    managerId: null as any,
    password: 'password123'
  });

  newHoliday = signal<Partial<HolidayRecord>>({
    holidayName: '',
    date: '',
    isOptional: false,
    description: ''
  });

  filteredUsers = computed(() => {
    const term = this.searchTerm().toLowerCase();
    return this.users().filter(u => 
      u.name.toLowerCase().includes(term) || 
      u.email.toLowerCase().includes(term) ||
      (u.employeeId && u.employeeId.toLowerCase().includes(term))
    );
  });

  getManagerName(managerId?: number): string {
    if (!managerId) return 'None';
    const mgr = this.users().find(u => u.id === managerId);
    return mgr ? mgr.name : 'Unknown';
  }

  ngOnInit() {
    this.loadUsers();
    this.loadHolidays();
    this.loadTeams();
  }

  loadUsers() {
    this.api.getUsers().subscribe(data => this.users.set(data));
  }

  loadHolidays() {
    this.api.getHolidays(new Date().getFullYear()).subscribe(data => this.holidays.set(data));
  }

  loadTeams() {
    this.api.getTeams().subscribe(data => this.teams.set(data));
  }

  submitDept() {
    this.api.createTeam(this.newDept()).subscribe(() => {
      alert('Department/Team added successfully');
      this.showDeptModal.set(false);
      this.loadTeams();
    });
  }

  deleteUser(userId: number) {
    if (confirm('Are you sure you want to delete this user? This action cannot be undone.')) {
      this.api.deleteUser(userId).subscribe(() => {
        alert('User deleted successfully');
        this.loadUsers();
      });
    }
  }

  toggleUserStatus(user: User) {
    const updatedUser = { ...user, isActive: !user.isActive };
    this.api.updateUser(user.id, updatedUser).subscribe(() => {
      user.isActive = !user.isActive;
      alert(`User ${user.isActive ? 'activated' : 'deactivated'}`);
    });
  }

  deleteHoliday(id: number) {
    if (confirm('Delete this holiday?')) {
      this.api.deleteHoliday(id).subscribe(() => {
        this.loadHolidays();
      });
    }
  }

  openAddUser() {
    this.isEditMode.set(false);
    this.editingUserId.set(null);
    this.newUser.set({
      name: '',
      email: '',
      role: 'EMPLOYEE',
      designation: '',
      department: '',
      managerId: null as any,
      password: 'password123'
    });
    this.showUserModal.set(true);
  }

  openEditUser(user: User) {
    this.isEditMode.set(true);
    this.editingUserId.set(user.id);
    this.newUser.set({
      name: user.name,
      email: user.email,
      role: user.role,
      designation: user.designation,
      department: user.department,
      managerId: user.managerId
    });
    this.showUserModal.set(true);
  }

  submitUser() {
    if (this.isEditMode()) {
      const id = this.editingUserId();
      if (id) {
        this.api.updateUser(id, this.newUser()).subscribe(() => {
          alert('User updated successfully');
          this.showUserModal.set(false);
          this.loadUsers();
        });
      }
    } else {
      this.api.createUser(this.newUser()).subscribe(() => {
        alert('User added successfully');
        this.showUserModal.set(false);
        this.loadUsers();
      });
    }
  }

  submitHoliday() {
    this.api.createHoliday(this.newHoliday()).subscribe(() => {
      alert('Holiday added successfully');
      this.showHolidayModal.set(false);
      this.loadHolidays();
    });
  }
}
