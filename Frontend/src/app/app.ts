import { Component, inject } from '@angular/core';
import { RouterOutlet, Router } from '@angular/router';
import { NavbarComponent } from './navbar/navbar';
import { FooterComponent } from './footer/footer';
import { AuthService } from './auth.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, NavbarComponent, FooterComponent],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App {
  authService = inject(AuthService);
  private router = inject(Router);

  isLandingPage(): boolean {
    return this.router.url === '/' || this.router.url === '';
  }
}