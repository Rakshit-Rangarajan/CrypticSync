import { Routes } from '@angular/router';
import { DashboardComponent } from './dashboard/dashboard';
import { Login } from './login/login';
import { RegularizationComponent } from './regularization/regularization';
import { LeaveApplicationComponent } from './leave-application/leave-application';
import { ReportsComponent } from './reports/reports';
import { SettingsComponent } from './settings/settings';
import { ContactHrComponent } from './contact-hr/contact-hr';
import { ManagerComponent } from './manager/manager';
import { AdminComponent } from './admin/admin';
import { ResetPasswordComponent } from './reset-password/reset-password';
import { LandingComponent } from './landing/landing';
import { authGuard, guestGuard } from './auth.guard';

export const routes: Routes = [
    { path: 'login', component: Login, canActivate: [guestGuard] },
    { path: 'reset-password', component: ResetPasswordComponent, canActivate: [guestGuard] },
    { path: 'dashboard', component: DashboardComponent, canActivate: [authGuard] },
    { path: 'regularization/:date', component: RegularizationComponent, canActivate: [authGuard] },
    { path: 'leave', component: LeaveApplicationComponent, canActivate: [authGuard] },
    { path: 'reports', component: ReportsComponent, canActivate: [authGuard] },
    { path: 'manager', component: ManagerComponent, canActivate: [authGuard] },
    { path: 'admin', component: AdminComponent, canActivate: [authGuard] },
    { path: 'settings', component: SettingsComponent, canActivate: [authGuard] },
    { path: 'contact-hr', component: ContactHrComponent, canActivate: [authGuard] },
    { path: '', component: LandingComponent },
    { path: '**', redirectTo: '' }
];