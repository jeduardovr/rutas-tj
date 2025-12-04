import { Routes } from '@angular/router';
import { HomeComponent } from './pages/home/home.component';
import { LoginComponent } from './pages/login/login.component';
import { CreateRouteComponent } from './pages/create-route/create-route.component';
import { AdminProposalsComponent } from './pages/admin-proposals/admin-proposals.component';
import { authGuard } from './guards/auth.guard';

export const routes: Routes = [
    { path: '', redirectTo: '/home', pathMatch: 'full' },
    { path: 'home', component: HomeComponent },
    { path: 'login', component: LoginComponent },
    {
        path: 'create-route',
        component: CreateRouteComponent,
        canActivate: [authGuard]
    },
    {
        path: 'admin-proposals',
        component: AdminProposalsComponent,
        canActivate: [authGuard]
    }
];