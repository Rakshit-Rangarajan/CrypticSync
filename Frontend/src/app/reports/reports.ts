import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AttendanceService } from '../attendance.service';

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
    present: 18,
    absent: 2,
    incomplete: 3,
    totalHours: 168
  };

  weekData: WeekDay[] = [
    { label: 'Mon', percentage: 100, status: 'present' },
    { label: 'Tue', percentage: 100, status: 'present' },
    { label: 'Wed', percentage: 80, status: 'incomplete' },
    { label: 'Thu', percentage: 100, status: 'present' },
    { label: 'Fri', percentage: 0, status: 'absent' },
    { label: 'Sat', percentage: 0, status: 'weekend' },
    { label: 'Sun', percentage: 0, status: 'weekend' }
  ];

  monthlyStats: MonthlyStats = {
    workingDays: 23,
    present: 18,
    absent: 2,
    onLeave: 3
  };

  attendanceHistory: HistoryRecord[] = [
    { date: '2026-04-25', status: 'PRESENT', punchIn: '09:00', punchOut: '18:00', hours: 8 },
    { date: '2026-04-24', status: 'PRESENT', punchIn: '09:15', punchOut: '17:45', hours: 7.5 },
    { date: '2026-04-23', status: 'PRESENT', punchIn: '09:00', punchOut: '18:00', hours: 8 },
    { date: '2026-04-22', status: 'INCOMPLETE', punchIn: '10:30', punchOut: '17:00', hours: 5.5 },
    { date: '2026-04-21', status: 'ABSENT', reason: 'Unregularized' },
    { date: '2026-04-18', status: 'LEAVE', reason: 'Sick Leave' }
  ];

  constructor(private api: AttendanceService) {}

  ngOnInit() {}

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