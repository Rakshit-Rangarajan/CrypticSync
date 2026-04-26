import { Routes } from '@angular/router';
import { DashboardComponent } from './dashboard/dashboard';
import { Login } from './login/login';
import { authGuard, guestGuard } from './auth.guard';

export const routes: Routes = [
    { path: 'login', component: Login, canActivate: [guestGuard] },
    { path: 'dashboard', component: DashboardComponent, canActivate: [authGuard] },
    { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
    { path: '**', redirectTo: 'login' }
];
