import { Component, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AttendanceService, LeaveRecord } from '../attendance.service';

interface LeaveBalance {
  type: string;
  used: number;
  total: number;
}

@Component({
  selector: 'app-leave-application',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './leave-application.html',
  styleUrl: './leave-application.css',
})
export class LeaveApplicationComponent implements OnInit {
  leaveType = '';
  startDate = '';
  endDate = '';
  leaveDuration: 'FULL_DAY' | 'HALF_DAY_MORNING' | 'HALF_DAY_EVENING' = 'FULL_DAY';
  reason = '';
  isSubmitting = false;

  leaveBalances: LeaveBalance[] = [];

  constructor(private router: Router, private api: AttendanceService) {}

  ngOnInit() {
    const today = new Date();
    this.minDate = today.toISOString().split('T')[0];
    this.loadBalances();
  }

  loadBalances() {
    this.api.getLeaveBalances().subscribe({
      next: (balances) => {
        this.leaveBalances = balances.map(b => ({
          type: b.leaveType,
          used: b.usedDays,
          total: b.totalDays
        }));
      }
    });
  }

  minDate: string = '';

  get duration(): number {
    if (!this.startDate || !this.endDate) return 0;
    const start = new Date(this.startDate);
    const end = new Date(this.endDate);
    if (end < start) return 0;
    let count = 0;
    const current = new Date(start);
    while (current <= end) {
      const day = current.getDay();
      if (day !== 0 && day !== 6) count++;
      current.setDate(current.getDate() + 1);
    }
    return count;
  }

  get selectedBalance(): LeaveBalance | undefined {
    return this.leaveBalances.find(b => b.type === this.leaveType);
  }

  getLeaveTypeName(type: string): string {
    return type.replace(/_/g, ' ');
  }

  selectLeaveType(type: string) {
    this.leaveType = type;
  }

  isFormValid(): boolean {
    return !!(this.leaveType && this.startDate && this.endDate && this.reason);
  }

  goBack() {
    this.router.navigate(['/dashboard']);
  }

  onSubmit() {
    if (!this.isFormValid()) {
      alert('Please fill in all required fields');
      return;
    }

    this.isSubmitting = true;

    const leaveRequest: Partial<LeaveRecord> = {
      leaveType: this.leaveType as any,
      startDate: this.startDate,
      endDate: this.endDate,
      duration: this.leaveDuration,
      reason: this.reason,
      status: 'PENDING' as any
    };

    this.api.requestLeave(leaveRequest).subscribe({
      next: () => {
        this.isSubmitting = false;
        alert('Leave request submitted successfully');
        this.router.navigate(['/dashboard']);
      },
      error: () => {
        this.isSubmitting = false;
        alert('Failed to submit leave request. Please try again.');
      }
    });
  }
}