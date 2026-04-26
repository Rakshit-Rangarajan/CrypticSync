import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { AttendanceService, LeaveRecord } from '../attendance.service';
import { AuthService } from '../auth.service';

@Component({
  selector: 'app-regularization',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './regularization.html',
  styleUrl: './regularization.css',
})
export class RegularizationComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private api = inject(AttendanceService);
  private auth = inject(AuthService);

  targetDate = signal<string>('');
  selectedStatus = signal<string>('PRESENT');
  punchInTime = signal<string>('09:00');
  punchOutTime = signal<string>('18:00');
  leaveType = signal<string>('');
  reason = signal<string>('');
  isSubmitting = signal(false);
  isToday = signal(false);

  recentRequests = signal<LeaveRecord[]>([]);

  ngOnInit() {
    const date = this.route.snapshot.params['date'];
    this.targetDate.set(date);
    
    const today = new Date().toISOString().split('T')[0];
    this.isToday.set(date === today);
    
    this.loadRecentRequests();
  }

  get isPastDate(): boolean {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const target = new Date(this.targetDate());
    return target < today;
  }

  get isFutureDate(): boolean {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const target = new Date(this.targetDate());
    return target > today;
  }

  get formattedDate(): string {
    const date = new Date(this.targetDate() + 'T00:00:00');
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  }

  goBack() {
    this.router.navigate(['/dashboard']);
  }

  loadRecentRequests() {
    this.api.getCurrentUserLeaves().subscribe({
      next: (data) => this.recentRequests.set(data.slice(0, 5)),
      error: (err) => console.error('Error loading leaves:', err)
    });
  }

  onSubmit() {
    if (!this.selectedStatus() || (!this.reason() && this.selectedStatus() !== 'PRESENT')) {
      alert('Please fill in all required fields');
      return;
    }

    this.isSubmitting.set(true);

    const record: any = {
      date: this.targetDate(),
      status: this.selectedStatus() as any,
      reason: this.reason()
    };

    if (this.selectedStatus() === 'PRESENT') {
      const dateStr = this.targetDate();
      record.punchIn = `${dateStr}T${this.punchInTime()}:00`;
      record.punchOut = `${dateStr}T${this.punchOutTime()}:00`;
      const hours = this.calculateHours();
      record.totalHours = hours;
      if (hours < 8) {
        record.status = 'INCOMPLETE';
      }
    } else if (this.selectedStatus() === 'LEAVE') {
      record.leaveType = this.leaveType();
    }

    const userId = this.auth.currentUser()?.id;
    if (!userId) {
      alert('User not authenticated');
      return;
    }

    this.api.markAttendance(userId, record).subscribe({
      next: () => {
        this.isSubmitting.set(false);
        alert('Regularization submitted successfully');
        this.router.navigate(['/dashboard']);
      },
      error: (err) => {
        this.isSubmitting.set(false);
        const errorMsg = err.error?.detail || 'Failed to submit regularization. Please try again.';
        alert(errorMsg);
      }
    });
  }

  private calculateHours(): number {
    const [inH, inM] = this.punchInTime().split(':').map(Number);
    const [outH, outM] = this.punchOutTime().split(':').map(Number);
    const hours = (outH * 60 + outM - inH * 60 - inM) / 60;
    return Math.max(0, hours);
  }
}