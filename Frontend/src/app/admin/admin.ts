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
  protected Math = Math;
  
  users = signal<User[]>([]);
  holidays = signal<HolidayRecord[]>([]);
  activeTab = signal<'users' | 'org' | 'logs'>('users');
  
  searchTerm = signal('');
  showUserModal = signal(false);
  showHolidayModal = signal(false);
  showDeptModal = signal(false);
  
  // Pagination
  currentPage = signal(1);
  pageSize = signal(10);
  
  teams = signal<any[]>([]);

  newDept = signal({ name: '', department: '' });

  isEditMode = signal(false);
  editingUserId = signal<number | null>(null);
  formStatus = signal<{ type: 'success' | 'error', message: string } | null>(null);

  newUser = signal<Partial<User>>({
    employeeId: '',
    name: '',
    email: '',
    role: 'EMPLOYEE',
    designation: '',
    department: '',
    managerId: null as any
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

  paginatedUsers = computed(() => {
    const start = (this.currentPage() - 1) * this.pageSize();
    return this.filteredUsers().slice(start, start + this.pageSize());
  });

  totalPages = computed(() => Math.ceil(this.filteredUsers().length / this.pageSize()));

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
      employeeId: '',
      name: '',
      email: '',
      role: 'EMPLOYEE',
      designation: '',
      department: '',
      managerId: null as any
    });
    this.showUserModal.set(true);
  }

  openEditUser(user: User) {
    this.isEditMode.set(true);
    this.editingUserId.set(user.id);
    this.newUser.set({
      employeeId: user.employeeId,
      name: user.name,
      email: user.email,
      role: user.role,
      designation: user.designation,
      department: user.department,
      managerId: user.managerId
    });
    this.showUserModal.set(true);
  }

  submitUser(keepOpen: boolean = false) {
    this.formStatus.set(null);
    
    const obs = this.isEditMode() 
      ? this.api.updateUser(this.editingUserId()!, this.newUser())
      : this.api.createUser(this.newUser());

    obs.subscribe({
      next: () => {
        this.formStatus.set({ type: 'success', message: `Employee ${this.isEditMode() ? 'updated' : 'created'} successfully!` });
        this.loadUsers();
        
        if (!keepOpen) {
          setTimeout(() => {
            this.showUserModal.set(false);
            this.formStatus.set(null);
          }, 1500);
        } else {
          // Keep open and reset
          const nextRole = this.newUser().role; // Keep role for multiple adds
          const nextDept = this.newUser().department;
          this.openAddUser();
          this.newUser.update(u => ({ ...u, role: nextRole, department: nextDept }));
          setTimeout(() => this.formStatus.set(null), 3000);
        }
      },
      error: (err) => {
        this.formStatus.set({ type: 'error', message: err.error?.detail || 'An error occurred' });
      }
    });
  }

  submitHoliday() {
    this.api.createHoliday(this.newHoliday()).subscribe(() => {
      alert('Holiday added successfully');
      this.showHolidayModal.set(false);
      this.loadHolidays();
    });
  }
}
