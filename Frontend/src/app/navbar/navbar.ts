import { Component, inject, signal, computed, OnInit, effect } from '@angular/core';
import { RouterLink, RouterLinkActive, Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { AuthService } from '../auth.service';
import { AttendanceService, AppNotification } from '../attendance.service';

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, CommonModule],
  templateUrl: './navbar.html',
  styleUrl: './navbar.css'
})
export class NavbarComponent implements OnInit {
  public authService = inject(AuthService);
  private api = inject(AttendanceService);
  private router = inject(Router);
  
  notifications = signal<AppNotification[]>([]);
  showNotifications = false;

  unreadCount = computed(() => 
    this.notifications().filter(n => !n.isRead).length
  );

  constructor() {
    // Load notifications as soon as user is authenticated
    effect(() => {
      if (this.authService.currentUser()) {
        this.loadNotifications();
      }
    });
  }

  ngOnInit() {
    this.loadNotifications();
    // Refresh notifications every 10 seconds
    setInterval(() => this.loadNotifications(), 10000);
  }

  loadNotifications() {
    if (this.authService.currentUser()) {
      this.api.getNotifications().subscribe(data => this.notifications.set(data));
    }
  }

  markAsRead(notification: any) {
    this.api.markNotificationRead(notification.id).subscribe(() => {
      this.loadNotifications();
      this.showNotifications = false;
      
      // Navigate based on notification content/type
      if (notification.message.includes('requested regularization') || 
          notification.title.includes('Request')) {
        this.router.navigate(['/manager']);
      } else if (notification.title.includes('Approved') || 
                 notification.title.includes('Rejected')) {
        this.router.navigate(['/reports']);
      }
    });
  }

  logout() {
    this.authService.logout();
  }

  getInitials(): string {
    const user = this.authService.currentUser();
    if (!user || !user.name) return '??';
    return user.name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  }
}
