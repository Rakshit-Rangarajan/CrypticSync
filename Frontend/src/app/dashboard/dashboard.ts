import { Component, inject, OnInit, signal, computed } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AttendanceService, User, AttendanceRecord, LeaveRecord, HolidayRecord, AppNotification } from '../attendance.service';
import { AuthService } from '../auth.service';

interface CalendarDay {
  date: Date;
  day: number;
  isCurrentMonth: boolean;
  isToday: boolean;
  isWeekend: boolean;
  isFuture: boolean;
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
  notifications = signal<AppNotification[]>([]);
  isLoading = signal(false);

  currentMonth = signal(new Date());
  selectedDate = signal(new Date());
  calendarDays = signal<CalendarDay[]>([]);
  currentWeekDates = signal<Date[]>([]);
  today = new Date();
  wfhSession = signal<AttendanceRecord | null>(null);
  wfhTimer = signal<string>('00:00:00');
  private timerInterval: any;

  leaveSummary = signal<LeaveSummary[]>([]);
  showLeaveModal = signal(false);
  selectedLeaveDate = signal<string>('');
  showNotifications = false;

  weekDays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

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
    this.checkTodayWFH();
    this.loadNotifications();
  }

  onWFHStart() {
    this.api.punchIn().subscribe(record => {
      this.wfhSession.set(record);
      this.startTimer();
    });
  }

  onWFHPause() {
    this.api.pause().subscribe(record => {
      this.wfhSession.set(record);
    });
  }

  onWFHResume() {
    this.api.resume().subscribe(record => {
      this.wfhSession.set(record);
    });
  }

  onWFHStop() {
    if (!confirm('Are you sure you want to stop your session for today?')) return;
    this.api.punchOut().subscribe(record => {
      if (this.timerInterval) clearInterval(this.timerInterval);
      this.wfhSession.set(null);
      this.wfhTimer.set('00:00:00');
      this.loadData();
      alert(`WFH Session ended. Total worked hours: ${record.totalHours?.toFixed(2)}`);
    });
  }

  private startTimer() {
    if (this.timerInterval) clearInterval(this.timerInterval);
    this.timerInterval = setInterval(() => {
      const session = this.wfhSession();
      if (!session || !session.punchIn) return;
      
      let totalSeconds = session.totalWorkedSeconds || 0;
      
      if (!session.isPaused && session.lastActionTime) {
        const lastAction = new Date(session.lastActionTime);
        const now = new Date();
        const diff = Math.floor((now.getTime() - lastAction.getTime()) / 1000);
        totalSeconds += diff;
      }
      
      const hours = Math.floor(totalSeconds / 3600);
      const minutes = Math.floor((totalSeconds % 3600) / 60);
      const seconds = totalSeconds % 60;
      
      this.wfhTimer.set(
        `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
      );
    }, 1000);
  }





  loadNotifications() {
    this.api.getNotifications().subscribe(data => this.notifications.set(data));
  }

  markAsRead(n: AppNotification) {
    this.api.markNotificationRead(n.id).subscribe(() => {
      this.loadNotifications();
    });
  }

  unreadCount = computed(() => this.notifications().filter(n => !n.isRead).length);

  ngOnDestroy() {
    if (this.timerInterval) clearInterval(this.timerInterval);
  }

  checkTodayWFH() {
    const todayStr = this.formatDate(new Date());
    this.api.getAttendance(todayStr).subscribe(data => {
      const todayRecord = data.find(a => a.userId === this.currentUser()?.id);
      if (todayRecord && todayRecord.status === 'WFH' && !todayRecord.punchOut) {
        this.wfhSession.set(todayRecord);
        this.startTimer();
      }
    });
  }

  generateCalendarDays() {
    const month = this.currentMonth();
    const year = month.getFullYear();
    const monthIndex = month.getMonth();
    const firstDay = new Date(year, monthIndex, 1);
    const lastDay = new Date(year, monthIndex + 1, 0);
    const startPadding = (firstDay.getDay() + 6) % 7;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

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
    const dateCopy = new Date(date);
    dateCopy.setHours(0, 0, 0, 0);
    return {
      date,
      day: date.getDate(),
      isCurrentMonth,
      isToday: this.isSameDay(date, today),
      isWeekend: dayOfWeek === 0 || dayOfWeek === 6,
      isFuture: dateCopy > today
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

    if (!day.isWeekend && day.isCurrentMonth && day.isFuture) return 'FUTURE';

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
      error: (err) => console.error('Error loading leaves:', err)
    });

    this.loadAllHolidays();

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
      error: (err) => console.error('Error loading monthly attendance:', err)
    });
  }

  loadAllHolidays() {
    this.api.getHolidays(this.currentMonth().getFullYear()).subscribe({
      next: (data) => this.holidays.set(data),
      error: (err) => console.error('Error loading holidays:', err)
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
            error: (err) => console.error('Error loading reportees attendance:', err)
          });
        }
      },
      error: (err) => console.error('Error loading reportees:', err)
    });
  }

  loadLeaveSummary() {
    this.api.getLeaveBalances().subscribe({
      next: (balances) => {
        const summary: LeaveSummary[] = balances.map(b => ({
          type: b.leaveType.replace('_', ' ').toLowerCase().split(' ').map(s => s.charAt(0).toUpperCase() + s.substring(1)).join(' '),
          used: b.usedDays,
          total: b.totalDays,
          color: this.getLeaveColor(b.leaveType)
        }));
        this.leaveSummary.set(summary);
      },
      error: (err) => console.error('Error loading leave balances:', err)
    });
  }

  private getLeaveColor(type: string): string {
    switch (type) {
      case 'SICK_LEAVE': return '#ef4444';
      case 'PAID_LEAVE': return '#22c55e';
      case 'CASUAL_LEAVE': return '#3b82f6';
      case 'EMERGENCY_LEAVE': return '#f59e0b';
      default: return '#6366f1';
    }
  }

  getReporteeAttendanceForDate(userId: number, date: Date): AttendanceRecord | undefined {
    const dateStr = this.formatDate(date);
    const reporteeData = this.reporteesAttendance().find(r => r.user.id === userId);
    return reporteeData?.attendance.find(a => a.date === dateStr);
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

    const joiningDateStr = this.currentUser()?.joiningDate;
    if (joiningDateStr) {
      const joiningDate = new Date(joiningDateStr);
      joiningDate.setHours(0, 0, 0, 0);
      if (targetDate < joiningDate) {
        alert(`Cannot regularize dates before your joining date (${joiningDateStr}).`);
        return;
      }
    }

    if (targetDate > today) {
      this.selectedLeaveDate.set(dateStr);
      this.showLeaveModal.set(true);
      return;
    }

    this.router.navigate(['/regularization', dateStr]);
  }

  closeLeaveModal() {
    this.showLeaveModal.set(false);
    this.selectedLeaveDate.set('');
  }

  applyForLeave() {
    this.router.navigate(['/leave']);
    this.closeLeaveModal();
  }

  getDayTooltip(day: CalendarDay): string {
    if (day.isWeekend) return 'Weekend';
    
    const dateStr = this.formatDate(day.date);
    const holiday = this.holidays().find(h => h.date === dateStr);
    if (holiday) return holiday.holidayName || 'Holiday';

    const status = this.getDayStatus(day);
    if (status === 'FUTURE') return 'Click to apply for leave';
    if (status === 'PRESENT') return 'Present';
    if (status === 'ABSENT') return 'Absent - Click to regularize';
    if (status === 'NOT_RECORDED') return 'Click to record attendance';
    if (status === 'HOLIDAY') return 'Holiday';
    if (status === 'LEAVE') return 'On Leave';
    if (status === 'INCOMPLETE') return 'Incomplete - Click to regularize';
    
    return 'Click to regularize';
  }

  getMonthName(): string {
    return this.currentMonth().toLocaleString('default', { month: 'long', year: 'numeric' });
  }

  getMonthHolidays(): HolidayRecord[] {
    const viewDate = this.currentMonth();
    const viewYear = viewDate.getFullYear();
    const viewMonth = viewDate.getMonth(); // 0-indexed

    return this.holidays().filter(h => {
      // Database date is 'YYYY-MM-DD'
      const hDate = new Date(h.date);
      return hDate.getFullYear() === viewYear && hDate.getMonth() === viewMonth;
    });
  }

  getPendingLeaves(): LeaveRecord[] {
    return this.leaves().filter(l => l.status === 'PENDING');
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

}