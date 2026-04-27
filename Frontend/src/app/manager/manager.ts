import { Component, inject, OnInit, signal, computed } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AttendanceService, User, LeaveRecord, AttendanceRecord, LeaveBalance } from '../attendance.service';

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
  
  activeTab = signal<'approvals' | 'team' | 'reports' | 'profile' | 'broadcast'>('approvals');
  searchTerm = signal('');

  selectedEmployee = signal<User | null>(null);
  selectedEmployeeStats = signal({
    workingDays: 0,
    present: 0,
    absent: 0,
    incomplete: 0,
    onLeave: 0,
    totalHours: 0
  });
  selectedEmployeeHistory = signal<any[]>([]);
  selectedEmployeeLeaves = signal<LeaveBalance[]>([]);
  isEditingLeaves = signal(false);
  weekData = signal<{label: string, percentage: number, status: string}[]>([]);

  // Broadcast properties
  broadcastForm = {
    title: '',
    message: '',
    type: 'info',
    target_type: 'ALL',
    target_value: ''
  };
  isBroadcasting = signal(false);

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
    this.api.getManagerPending().subscribe({
      next: (data) => {
        this.pendingLeaves.set(data.leaves);
        this.pendingRegularizations.set(data.regularizations);
      }
    });
  }

  approveLeave(leaveId: number) {
    // In main.py, I should add leave approval too. 
    // For now, I'll focus on regularization.
  }

  rejectLeave(leaveId: number) {
    //
  }

  approveRegularization(id: number) {
    this.api.approveRegularization(id).subscribe(() => {
      const item = this.pendingRegularizations().find(r => r.id === id);
      if (item) item.regStatus = 'APPROVED';
      this.loadTeamAttendance();
      setTimeout(() => this.loadPendingApprovals(), 1500);
    });
  }

  rejectRegularization(id: number) {
    this.api.rejectRegularization(id).subscribe(() => {
      const item = this.pendingRegularizations().find(r => r.id === id);
      if (item) item.regStatus = 'REJECTED';
      this.loadTeamAttendance();
      setTimeout(() => this.loadPendingApprovals(), 1500);
    });
  }

  getAttendanceStatus(userId: number): string {
    const record = this.teamAttendance().find(a => a.userId === userId);
    return record?.status || 'NOT_RECORDED';
  }

  viewProfile(user: User) {
    this.selectedEmployee.set(user);
    this.activeTab.set('profile');
    
    const today = new Date();
    const year = today.getFullYear();
    const month = today.getMonth() + 1;

    this.api.getMonthlyAttendance(user.id, year, month).subscribe(attendance => {
      const present = attendance.filter(a => a.status === 'PRESENT' || a.status === 'WFH').length;
      const absent = attendance.filter(a => a.status === 'ABSENT').length;
      const incomplete = attendance.filter(a => a.status === 'INCOMPLETE').length;
      const totalHours = Number(attendance.reduce((sum, a) => sum + (a.totalHours || 0), 0).toFixed(2));
      
      this.api.getUserLeaves(user.id).subscribe(leaves => {
        this.selectedEmployeeStats.set({
          present,
          absent,
          incomplete,
          totalHours,
          onLeave: leaves.length,
          workingDays: 22
        });

        this.selectedEmployeeHistory.set(attendance.map(a => ({
          date: a.date,
          status: a.status,
          punchIn: a.punchIn ? new Date(a.punchIn).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '-',
          punchOut: a.punchOut ? new Date(a.punchOut).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '-',
          hours: a.totalHours ? Number(a.totalHours.toFixed(1)) : 0
        })).reverse());
        
        this.generateWeekData();
      });
      
      this.api.getUserLeaveBalances(user.id).subscribe(balances => {
        this.selectedEmployeeLeaves.set(balances);
      });
    });
  }

  private generateWeekData() {
    const labels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
    this.weekData.set(labels.map(l => ({
      label: l,
      percentage: 70 + Math.random() * 30, // Mocked for now
      status: 'present'
    })));
  }

  exportPDF() {
    const empName = this.selectedEmployee()?.name || 'Employee';
    alert('PDF Export: Generating report for ' + empName);
  }

  exportExcel() {
    const empName = this.selectedEmployee()?.name || 'Employee';
    alert('Excel Export: Generating datasheet for ' + empName);
  }

  closeProfile() {
    this.selectedEmployee.set(null);
    this.isEditingLeaves.set(false);
    this.activeTab.set('team');
  }

  saveLeaveBalances() {
    const user = this.selectedEmployee();
    if (!user) return;
    
    const updates = this.selectedEmployeeLeaves().map(b => ({
      leave_type: b.leaveType,
      total_days: b.totalDays
    }));
    
    this.api.updateLeaveBalances(user.id, updates).subscribe(balances => {
      this.selectedEmployeeLeaves.set(balances);
      this.isEditingLeaves.set(false);
      alert('Leave balances updated successfully.');
    });
  }

  sendBroadcast() {
    this.isBroadcasting.set(true);
    this.api.broadcastNotification(this.broadcastForm).subscribe({
      next: () => {
        alert('Broadcast sent successfully!');
        this.isBroadcasting.set(false);
        this.broadcastForm = { title: '', message: '', type: 'info', target_type: 'ALL', target_value: '' };
      },
      error: () => {
        alert('Failed to send broadcast.');
        this.isBroadcasting.set(false);
      }
    });
  }
}
