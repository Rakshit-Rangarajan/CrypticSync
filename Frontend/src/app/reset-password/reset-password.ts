import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService } from '../auth.service';

@Component({
  selector: 'app-reset-password',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './reset-password.html',
  styleUrl: './reset-password.css'
})
export class ResetPasswordComponent implements OnInit {
  token = '';
  newPassword = '';
  confirmPassword = '';
  
  isLoading = signal(false);
  error = signal('');
  successMessage = signal('');

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private authService: AuthService
  ) {}

  ngOnInit() {
    this.route.queryParams.subscribe(params => {
      this.token = params['token'] || '';
      if (!this.token) {
        this.error.set('Invalid or missing reset token.');
      }
    });
  }

  onSubmit() {
    if (!this.token) {
      this.error.set('Invalid token. Please request a new password reset link.');
      return;
    }
    
    if (this.newPassword !== this.confirmPassword) {
      this.error.set('Passwords do not match.');
      return;
    }
    
    if (this.newPassword.length < 8) {
      this.error.set('Password must be at least 8 characters long.');
      return;
    }

    this.isLoading.set(true);
    this.error.set('');

    this.authService.resetPassword(this.token, this.newPassword).subscribe({
      next: () => {
        this.isLoading.set(false);
        this.successMessage.set('Password has been set successfully! Redirecting to login...');
        setTimeout(() => {
          this.router.navigate(['/login']);
        }, 3000);
      },
      error: (err) => {
        this.isLoading.set(false);
        this.error.set(err.error?.detail || 'Failed to reset password. The link might have expired.');
      }
    });
  }
}
