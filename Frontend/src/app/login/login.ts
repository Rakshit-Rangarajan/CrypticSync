import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './login.html',
  styleUrl: './login.css',
})
export class Login {
  username = '';
  password = '';
  isLoading = signal(false);
  error = signal('');

  constructor(private authService: AuthService) {}

  onSubmit() {
    if (!this.username || !this.password) {
      this.error.set('Please enter both username and password');
      return;
    }

    this.isLoading.set(true);
    this.error.set('');

    this.authService.login(this.username, this.password).subscribe({
      next: () => {
        this.isLoading.set(false);
      },
      error: (err) => {
        this.isLoading.set(false);
        this.error.set('Invalid username or password');
        console.error('Login failed', err);
      }
    });
  }
}
