import { Component, inject, OnInit, signal, computed, effect } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AttendanceService, User, AttendanceRecord, LeaveRecord, HolidayRecord } from '../attendance.service';
import { AuthService } from '../auth.service';

interface CalendarDay {
  date: Date;
  day: number;
  isCurrentMonth: boolean;
  isToday: boolean;
  isWeekend: boolean;
}

interface LeaveSummary {
  type: string;
  used: number;
  total: number;
  color: string;
}

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule, DatePipe, RouterLink],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.css',
})
export class DashboardComponent implements OnInit {
  private api = inject(AttendanceService);
  private auth = inject(AuthService);
  private router = inject(Router);

  users = signal<User[]>([]);
  attendance = signal<AttendanceRecord[]>([]);
  monthlyAttendance = signal<AttendanceRecord[]>([]);
  leaves = signal<LeaveRecord[]>([]);
  holidays = signal<HolidayRecord[]>([]);
  reportees = signal<User[]>([]);
  reporteesAttendance = signal<{ user: User; attendance: AttendanceRecord[] }[]>([]);
  isLoading = signal(false);

  currentMonth = signal(new Date());
  selectedDate = signal(new Date());
  calendarDays = signal<CalendarDay[]>([]);
  currentWeekDates = signal<Date[]>([]);
  today = new Date();

  leaveTypes = signal<string[]>(['Sick Leave', 'Paid Leave', 'Personal Leave', 'Emergency Leave', 'Maternity Leave', 'Paternity Leave']);
  leaveSummary = signal<LeaveSummary[]>([]);

  weekDays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  leaveTypeColors: Record<string, string> = {
    'Sick Leave': '#ef4444',
    'Paid Leave': '#22c55e',
    'Personal Leave': '#3b82f6',
    'Emergency Leave': '#f59e0b',
    'Maternity Leave': '#ec4899',
    'Paternity Leave': '#8b5cf6',
  };

  isManager = computed(() => this.auth.hasRole('MANAGER') || this.auth.hasRole('ADMIN'));
  currentUser = computed(() => this.auth.currentUser());

  totalUsers = computed(() => this.users().length);
  presentCount = computed(() => this.attendance().filter(a => a.status === 'PRESENT').length);
  absentCount = computed(() => this.totalUsers() - this.presentCount());

  ngOnInit() {
    this.generateCalendarDays();
    this.generateCurrentWeek();
    this.loadData();
    this.loadLeaveSummary();
  }

  generateCalendarDays() {
    const month = this.currentMonth();
    const year = month.getFullYear();
    const monthIndex = month.getMonth();
    const firstDay = new Date(year, monthIndex, 1);
    const lastDay = new Date(year, monthIndex + 1, 0);
    const startPadding = (firstDay.getDay() + 6) % 7;
    const today = new Date();

    const days: CalendarDay[] = [];

    for (let i = startPadding - 1; i >= 0; i--) {
      const date = new Date(year, monthIndex, -i);
      days.push(this.createCalendarDay(date, false, today));
    }

    for (let d = 1; d <= lastDay.getDate(); d++) {
      const date = new Date(year, monthIndex, d);
      days.push(this.createCalendarDay(date, true, today));
    }

    const remainingDays = 42 - days.length;
    for (let i = 1; i <= remainingDays; i++) {
      const date = new Date(year, monthIndex + 1, i);
      days.push(this.createCalendarDay(date, false, today));
    }

    this.calendarDays.set(days);
  }

  private createCalendarDay(date: Date, isCurrentMonth: boolean, today: Date): CalendarDay {
    const dayOfWeek = date.getDay();
    return {
      date,
      day: date.getDate(),
      isCurrentMonth,
      isToday: this.isSameDay(date, today),
      isWeekend: dayOfWeek === 0 || dayOfWeek === 6
    };
  }

  private isSameDay(d1: Date, d2: Date): boolean {
    return d1.getDate() === d2.getDate() &&
      d1.getMonth() === d2.getMonth() &&
      d1.getFullYear() === d2.getFullYear();
  }

  getDayStatus(day: CalendarDay): string | undefined {
    if (day.isWeekend) return 'HOLIDAY';

    const dateStr = this.formatDate(day.date);
    const holiday = this.holidays().find(h => h.date === dateStr);
    if (holiday) return 'HOLIDAY';

    const attendance = this.monthlyAttendance().find(a => a.date === dateStr);
    if (attendance) {
      if (attendance.status === 'LEAVE') {
        const leave = this.leaves().find(l =>
          l.userId === this.currentUser()?.id &&
          l.status === 'APPROVED' &&
          dateStr >= l.startDate &&
          dateStr <= l.endDate
        );
        if (leave) return 'LEAVE';
      }
      if (attendance.status === 'INCOMPLETE' || (attendance.totalHours !== undefined && attendance.totalHours < 8)) {
        return 'INCOMPLETE';
      }
      return attendance.status as 'PRESENT' | 'ABSENT';
    }

    const leave = this.leaves().find(l =>
      l.userId === this.currentUser()?.id &&
      l.status === 'APPROVED' &&
      dateStr >= l.startDate &&
      dateStr <= l.endDate
    );
    if (leave) return 'LEAVE';

    if (!day.isWeekend && day.isCurrentMonth && day.isToday) return 'NOT_RECORDED';

    return undefined;
  }

  getStatusClass(day: CalendarDay): string {
    if (day.isWeekend) return 'weekend';
    const status = this.getDayStatus(day);
    return status ? `status-${status.toLowerCase()}` : '';
  }

  formatDate(date: Date): string {
    return date.toISOString().split('T')[0];
  }

  getStatusCount(status: string): number {
    return this.monthlyAttendance().filter(a => a.status === status).length;
  }

  getHolidayCount(): number {
    const year = this.currentMonth().getFullYear();
    const month = this.currentMonth().getMonth() + 1;
    return this.holidays().filter(h => {
      const holidayDate = new Date(h.date);
      return holidayDate.getMonth() + 1 === month && holidayDate.getFullYear() === year;
    }).length;
  }

  generateCurrentWeek() {
    const today = new Date();
    const dayOfWeek = (today.getDay() + 6) % 7;
    const monday = new Date(today);
    monday.setDate(today.getDate() - dayOfWeek);

    const dates: Date[] = [];
    for (let i = 0; i < 7; i++) {
      const date = new Date(monday);
      date.setDate(monday.getDate() + i);
      dates.push(date);
    }
    this.currentWeekDates.set(dates);
  }

  previousMonth() {
    const prev = new Date(this.currentMonth());
    prev.setMonth(prev.getMonth() - 1);
    this.currentMonth.set(prev);
    this.generateCalendarDays();
    this.loadMonthlyData();
  }

  nextMonth() {
    const next = new Date(this.currentMonth());
    next.setMonth(next.getMonth() + 1);
    this.currentMonth.set(next);
    this.generateCalendarDays();
    this.loadMonthlyData();
  }

  loadData() {
    this.isLoading.set(true);
    this.api.getUsers().subscribe(data => this.users.set(data));

    const today = this.formatDate(new Date());
    this.api.getAttendance(today).subscribe(data => {
      this.attendance.set(data);
      this.isLoading.set(false);
    });

    this.loadMonthlyData();

    this.api.getCurrentUserLeaves().subscribe({
      next: (data) => this.leaves.set(data),
      error: () => this.loadMockLeaves()
    });

    this.api.getHolidays(this.currentMonth().getFullYear(), this.currentMonth().getMonth() + 1)
      .subscribe({
        next: (data) => this.holidays.set(data),
        error: () => this.loadMockHolidays()
      });

    if (this.isManager()) {
      this.loadReporteesData();
    }
  }

  loadMonthlyData() {
    const userId = this.currentUser()?.id;
    if (!userId) return;

    const month = this.currentMonth();
    this.api.getMonthlyAttendance(userId, month.getFullYear(), month.getMonth() + 1).subscribe({
      next: (data) => this.monthlyAttendance.set(data),
      error: () => this.loadMockMonthlyAttendance()
    });
  }

  loadReporteesData() {
    this.api.getReportees().subscribe({
      next: (data) => {
        this.reportees.set(data);
        const monday = this.currentWeekDates()[0];
        if (monday) {
          this.api.getReporteesAttendance(this.formatDate(monday)).subscribe({
            next: (attendanceData) => this.reporteesAttendance.set(attendanceData),
            error: () => this.loadMockReporteesAttendance()
          });
        }
      },
      error: () => this.loadMockReportees()
    });
  }

  loadLeaveSummary() {
    const summary: LeaveSummary[] = [
      { type: 'Sick Leave', used: 2, total: 10, color: '#ef4444' },
      { type: 'Paid Leave', used: 5, total: 20, color: '#22c55e' },
      { type: 'Personal Leave', used: 1, total: 5, color: '#3b82f6' },
      { type: 'Emergency Leave', used: 0, total: 5, color: '#f59e0b' },
    ];
    this.leaveSummary.set(summary);
  }

  getLeaveForType(type: string): LeaveRecord[] {
    return this.leaves().filter(l => l.leaveType === type);
  }

  getReporteeAttendanceForDate(userId: number, date: Date): AttendanceRecord | undefined {
    const dateStr = this.formatDate(date);
    const reporteeData = this.reporteesAttendance().find(r => r.user.id === userId);
    return reporteeData?.attendance.find(a => a.date === dateStr);
  }

  isUserPresent(userId: number) {
    return this.attendance().some(a => a.userId === userId && a.status === 'PRESENT');
  }

  toggleAttendance(user: User) {
    const present = this.isUserPresent(user.id);
    const newStatus = present ? 'ABSENT' : 'PRESENT';

    this.api.markAttendance(user.id, {
      date: this.formatDate(new Date()),
      status: newStatus,
      punchIn: newStatus === 'PRESENT' ? new Date().toISOString() : undefined
    }).subscribe(() => this.loadData());
  }

  addEmployee() {
    alert("User registration is managed by the Admin.");
  }

  getMonthName(): string {
    return this.currentMonth().toLocaleString('default', { month: 'long', year: 'numeric' });
  }

  isLeapYear(year: number): boolean {
    return (year % 4 === 0 && year % 100 !== 0) || (year % 400 === 0);
  }

  getDaysInMonth(): number {
    const month = this.currentMonth().getMonth();
    const year = this.currentMonth().getFullYear();
    const daysInMonths = [31, this.isLeapYear(year) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    return daysInMonths[month];
  }

  getMonthHolidays(): HolidayRecord[] {
    const year = this.currentMonth().getFullYear();
    const month = this.currentMonth().getMonth() + 1;
    return this.holidays().filter(h => {
      const d = new Date(h.date);
      return d.getMonth() + 1 === month && d.getFullYear() === year;
    });
  }

  getPendingLeaves(): LeaveRecord[] {
    return this.leaves().filter(l => l.status === 'PENDING');
  }

  private loadMockLeaves() {
    const mockLeaves: LeaveRecord[] = [
      { id: 1, userId: 1, leaveType: 'Sick Leave', startDate: '2026-04-01', endDate: '2026-04-02', reason: 'Flu', status: 'APPROVED', createdAt: '2026-03-28' },
      { id: 2, userId: 1, leaveType: 'Paid Leave', startDate: '2026-04-15', endDate: '2026-04-16', reason: 'Personal work', status: 'APPROVED', createdAt: '2026-04-10' },
      { id: 3, userId: 1, leaveType: 'Personal Leave', startDate: '2026-05-01', endDate: '2026-05-03', reason: 'Family event', status: 'PENDING', createdAt: '2026-04-20' },
    ];
    this.leaves.set(mockLeaves);
  }

  private loadMockHolidays() {
    const mockHolidays: HolidayRecord[] = [
      { id: 1, name: 'New Year\'s Day', date: '2026-01-01', description: 'New Year celebration' },
      { id: 2, name: 'Independence Day', date: '2026-03-14', description: 'National holiday' },
      { id: 3, name: 'Good Friday', date: '2026-04-03', description: 'Christian holiday' },
      { id: 4, name: 'May Day', date: '2026-05-01', description: 'International Workers\' Day' },
    ];
    this.holidays.set(mockHolidays);
  }

  private loadMockMonthlyAttendance() {
    const userId = this.currentUser()?.id || 1;
    const month = this.currentMonth();
    const year = month.getFullYear();
    const monthIndex = month.getMonth();
    const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();

    const mockAttendance: AttendanceRecord[] = [];
    for (let d = 1; d <= daysInMonth; d++) {
      const date = new Date(year, monthIndex, d);
      const dayOfWeek = date.getDay();

      if (dayOfWeek === 0 || dayOfWeek === 6) continue;

      const dateStr = date.toISOString().split('T')[0];
      const rand = Math.random();

      let status: 'PRESENT' | 'ABSENT' | 'INCOMPLETE';
      if (rand < 0.85) {
        status = 'PRESENT';
      } else if (rand < 0.92) {
        status = 'ABSENT';
      } else {
        status = 'INCOMPLETE';
      }

      mockAttendance.push({
        id: d,
        userId,
        date: dateStr,
        punchIn: status === 'PRESENT' ? `${dateStr}T09:00:00` : undefined,
        punchOut: status === 'PRESENT' ? `${dateStr}T18:00:00` : undefined,
        totalHours: status === 'PRESENT' ? 8 : status === 'INCOMPLETE' ? 5 : undefined,
        status
      });
    }
    this.monthlyAttendance.set(mockAttendance);
  }

  private loadMockReportees() {
    const mockReportees: User[] = [
      { id: 2, employeeId: 'EMP-1002', name: 'Alice Johnson', email: 'alice@crypticsync.com', department: 'Engineering', role: 'EMPLOYEE', managerId: 1, isActive: true },
      { id: 3, employeeId: 'EMP-1003', name: 'Bob Smith', email: 'bob@crypticsync.com', department: 'Engineering', role: 'EMPLOYEE', managerId: 1, isActive: true },
      { id: 4, employeeId: 'EMP-1004', name: 'Carol Davis', email: 'carol@crypticsync.com', department: 'Marketing', role: 'EMPLOYEE', managerId: 1, isActive: true },
      { id: 5, employeeId: 'EMP-1005', name: 'David Wilson', email: 'david@crypticsync.com', department: 'Sales', role: 'EMPLOYEE', managerId: 1, isActive: true },
    ];
    this.reportees.set(mockReportees);
    this.loadMockReporteesAttendance();
  }

  private loadMockReporteesAttendance() {
    const monday = this.currentWeekDates()[0] || new Date();
    const mockData: { user: User; attendance: AttendanceRecord[] }[] = this.reportees().map(user => {
      const attendance: AttendanceRecord[] = this.currentWeekDates().map((date, i) => {
        const dateStr = this.formatDate(date);
        const isWeekend = date.getDay() === 0 || date.getDay() === 6;

        let status: 'PRESENT' | 'ABSENT' | 'HOLIDAY' = 'PRESENT';
        if (isWeekend) {
          status = 'HOLIDAY';
        } else if (Math.random() < 0.15) {
          status = 'ABSENT';
        }

        return {
          id: user.id * 10 + i,
          userId: user.id,
          date: dateStr,
          punchIn: status === 'PRESENT' ? `${dateStr}T09:00:00` : undefined,
          punchOut: status === 'PRESENT' ? `${dateStr}T18:00:00` : undefined,
          totalHours: status === 'PRESENT' ? 8 : undefined,
          status
        };
      });

      return { user, attendance };
    });

    this.reporteesAttendance.set(mockData);
  }

  getAttendanceIcon(userId: number, date: Date): string {
    const record = this.getReporteeAttendanceForDate(userId, date);
    if (!record) return '○';
    switch (record.status) {
      case 'PRESENT': return '●';
      case 'ABSENT': return '×';
      case 'HOLIDAY': return '★';
      default: return '○';
    }
  }

  getAttendanceColor(userId: number, date: Date): string {
    const record = this.getReporteeAttendanceForDate(userId, date);
    if (!record) return 'var(--text-muted)';
    switch (record.status) {
      case 'PRESENT': return 'var(--success-color)';
      case 'ABSENT': return 'var(--danger-color)';
      case 'HOLIDAY': return 'var(--accent-color)';
      default: return 'var(--text-muted)';
    }
  }

  onDateClick(day: CalendarDay) {
    if (!day.isCurrentMonth || day.isWeekend) return;

    const dateStr = this.formatDate(day.date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const targetDate = new Date(day.date);
    targetDate.setHours(0, 0, 0, 0);

    if (targetDate > today) {
      alert('Cannot regularize future dates.');
      return;
    }

    this.router.navigate(['/regularization', dateStr]);
  }

  getDayTooltip(day: CalendarDay): string {
    if (day.isWeekend) return 'Weekend';
    const status = this.getDayStatus(day);
    if (!status) {
      if (day.isCurrentMonth && !day.isToday) return 'Click to regularize';
      return 'No record';
    }
    return status;
  }
}