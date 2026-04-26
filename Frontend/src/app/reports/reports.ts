import { Component, OnInit, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AttendanceService } from '../attendance.service';
import { AuthService } from '../auth.service';

interface WeekDay {
  label: string;
  percentage: number;
  status: string;
}

interface MonthlyStats {
  workingDays: number;
  present: number;
  absent: number;
  onLeave: number;
}

interface HistoryRecord {
  date: string;
  status: string;
  punchIn?: string;
  punchOut?: string;
  hours?: number;
}

@Component({
  selector: 'app-reports',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './reports.html',
  styleUrl: './reports.css',
})
export class ReportsComponent implements OnInit {
  stats = {
    present: 0,
    absent: 0,
    incomplete: 0,
    totalHours: 0
  };

  weekData: WeekDay[] = [];
  monthlyStats: MonthlyStats = {
    workingDays: 0,
    present: 0,
    absent: 0,
    onLeave: 0
  };

  attendanceHistory: HistoryRecord[] = [];

  private auth = inject(AuthService);

  constructor(private api: AttendanceService) {}

  ngOnInit() {
    this.loadReports();
  }

  loadReports() {
    const user = this.auth.currentUser();
    if (!user) return;

    const today = new Date();
    const year = today.getFullYear();
    const month = today.getMonth() + 1;

    this.api.getCurrentUserLeaves().subscribe(leaves => {
      this.api.getMonthlyAttendance(user.id, year, month).subscribe(attendance => {
        this.processData(attendance, leaves);
      });
    });
  }

  private processData(attendance: any[], leaves: any[]) {
    // Basic processing to replace hardcoded values
    this.stats.present = attendance.filter(a => a.status === 'PRESENT').length;
    this.stats.absent = attendance.filter(a => a.status === 'ABSENT').length;
    this.stats.incomplete = attendance.filter(a => a.status === 'INCOMPLETE').length;
    this.stats.totalHours = attendance.reduce((sum, a) => sum + (a.totalHours || 0), 0);

    this.attendanceHistory = attendance.map(a => ({
      date: a.date,
      status: a.status,
      punchIn: a.punchIn ? new Date(a.punchIn).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : undefined,
      punchOut: a.punchOut ? new Date(a.punchOut).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : undefined,
      hours: a.totalHours
    })).reverse();
  }

  exportPDF() {
    alert('PDF export functionality would be implemented here');
  }

  exportExcel() {
    alert('Excel export functionality would be implemented here');
  }
}

interface HistoryRecord {
  date: string;
  status: string;
  punchIn?: string;
  punchOut?: string;
  hours?: number;
  reason?: string;
}