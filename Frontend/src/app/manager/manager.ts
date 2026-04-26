import { Component, inject, OnInit, signal, computed } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AttendanceService, User, LeaveRecord, AttendanceRecord } from '../attendance.service';

@Component({
  selector: 'app-manager',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './manager.html',
  styleUrl: './manager.css'
})
export class ManagerComponent implements OnInit {
  private api = inject(AttendanceService);
  
  reportees = signal<User[]>([]);
  pendingLeaves = signal<LeaveRecord[]>([]);
  pendingRegularizations = signal<any[]>([]); // To be implemented
  teamAttendance = signal<any[]>([]);
  
  activeTab = signal<'approvals' | 'team' | 'reports'>('approvals');
  searchTerm = signal('');

  filteredReportees = computed(() => {
    const term = this.searchTerm().toLowerCase();
    return this.reportees().filter(u => 
      u.name.toLowerCase().includes(term) || 
      u.employeeId.toLowerCase().includes(term) ||
      u.department?.toLowerCase().includes(term)
    );
  });

  ngOnInit() {
    this.loadTeamData();
    this.loadPendingApprovals();
  }

  loadTeamData() {
    this.api.getReportees().subscribe(data => {
      this.reportees.set(data);
      this.loadTeamAttendance();
    });
  }

  loadTeamAttendance() {
    const today = new Date().toISOString().split('T')[0];
    this.api.getAttendance(today).subscribe(data => {
      this.teamAttendance.set(data);
    });
  }

  loadPendingApprovals() {
    // In a real app, this would be a specific manager endpoint
    this.api.getCurrentUserLeaves().subscribe(data => {
      // Mocking pending leaves for reportees for now
      // In production, the backend /api/leaves/pending would return these
    });
  }

  approveLeave(leaveId: number) {
    // API call to approve
    alert('Leave Approved');
  }

  rejectLeave(leaveId: number) {
    // API call to reject
    alert('Leave Rejected');
  }

  getAttendanceStatus(userId: number): string {
    const record = this.teamAttendance().find(a => a.userId === userId);
    return record?.status || 'NOT_RECORDED';
  }
}
