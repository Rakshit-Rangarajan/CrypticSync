import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../auth.service';
import { AttendanceService } from '../attendance.service';

@Component({
  selector: 'app-landing',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
  templateUrl: './landing.html',
  styleUrl: './landing.css'
})
export class LandingComponent {
  authService = inject(AuthService);
  private attendanceService = inject(AttendanceService);
  
  selectedDraft = signal<string | null>(null);
  contactStatus = signal<{ type: 'success' | 'error', message: string } | null>(null);
  
  review = {
    name: '',
    email: '',
    rating: 5,
    message: ''
  };

  submitReview() {
    this.contactStatus.set(null);
    this.attendanceService.submitContact(this.review).subscribe({
      next: () => {
        this.contactStatus.set({ type: 'success', message: 'Feedback sent successfully! Thank you.' });
        this.review = { name: '', email: '', rating: 5, message: '' };
        setTimeout(() => this.contactStatus.set(null), 5000);
      },
      error: (err) => {
        this.contactStatus.set({ type: 'error', message: 'Failed to send feedback. Please try again later.' });
        console.error(err);
      }
    });
  }
}
