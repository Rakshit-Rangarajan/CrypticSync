import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../auth.service';
import { AttendanceService, HolidayRecord } from '../attendance.service';

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './settings.html',
  styleUrl: './settings.css',
})
export class SettingsComponent {
  activeSection = 'profile';
  theme = 'dark';

  auth = inject(AuthService);
  api = inject(AttendanceService);
  
  currentUser = this.auth.currentUser;

  teams = signal<any[]>([]);
  holidays = signal<HolidayRecord[]>([]);

  newTeam = { name: '', department: '' };
  newHoliday = { date: '', holidayName: '', description: '', isOptional: false };

  constructor() {
    this.loadData();
  }

  loadData() {
    if (this.auth.hasRole('ADMIN')) {
      this.api.getTeams().subscribe(data => this.teams.set(data));
      this.api.getHolidays(new Date().getFullYear()).subscribe(data => this.holidays.set(data));
    }
  }

  addTeam() {
    this.api.createTeam(this.newTeam).subscribe(() => {
      this.loadData();
      this.newTeam = { name: '', department: '' };
    });
  }

  addHoliday() {
    this.api.createHoliday(this.newHoliday).subscribe(() => {
      this.loadData();
      this.newHoliday = { date: '', holidayName: '', description: '', isOptional: false };
    });
  }

  deleteHoliday(id: number) {
    this.api.deleteHoliday(id).subscribe(() => this.loadData());
  }
}