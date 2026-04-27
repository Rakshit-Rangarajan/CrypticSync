import { Component, OnInit, signal, inject, effect } from '@angular/core';
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
  reason?: string;
}

@Component({
  selector: 'app-reports',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './reports.html',
  styleUrl: './reports.css',
})
export class ReportsComponent implements OnInit {
  private auth = inject(AuthService);
  private api = inject(AttendanceService);

  stats = {
    present: 0,
    absent: 0,
    incomplete: 0,
    totalHours: 0
  };

  weekData = signal<WeekDay[]>([]);
  monthlyStats = signal<MonthlyStats>({
    workingDays: 0,
    present: 0,
    absent: 0,
    onLeave: 0
  });

  attendanceHistory = signal<HistoryRecord[]>([]);

  constructor() {
    effect(() => {
      if (this.auth.currentUser()) {
        this.loadReports();
      }
    });
  }

  ngOnInit() {}

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
    // Basic stats
    this.stats.present = attendance.filter(a => a.status === 'PRESENT' || a.status === 'WFH').length;
    this.stats.absent = attendance.filter(a => a.status === 'ABSENT').length;
    this.stats.incomplete = attendance.filter(a => a.status === 'INCOMPLETE').length;
    this.stats.totalHours = Number(attendance.reduce((sum, a) => sum + (a.totalHours || 0), 0).toFixed(2));

    // Monthly stats
    this.monthlyStats.set({
      workingDays: 22, // Static for now
      present: this.stats.present,
      absent: this.stats.absent,
      onLeave: leaves.length
    });

    // History
    this.attendanceHistory.set(attendance.map(a => ({
      date: a.date,
      status: a.status,
      punchIn: a.punchIn ? new Date(a.punchIn).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '-',
      punchOut: a.punchOut ? new Date(a.punchOut).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '-',
      hours: a.totalHours ? Number(a.totalHours.toFixed(1)) : 0
    })).reverse());

    // Generate weekly chart data
    this.generateWeekData();
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
    alert('PDF Export: Generating report for ' + this.auth.currentUser()?.name);
  }

  exportExcel() {
    alert('Excel Export: Generating datasheet...');
  }
}