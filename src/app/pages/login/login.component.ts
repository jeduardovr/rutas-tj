import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '@services/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './login.component.html',
  styleUrl: './login.component.css'
})
export class LoginComponent implements OnInit {
  isRegisterMode = false;
  loginData = { email: '', password: '' };
  registerData = { name: '', email: '', password: '' };
  authError = '';

  constructor(public authService: AuthService, private router: Router) { }

  ngOnInit() {
    setTimeout(() => this.initGoogleButton(), 200);
  }

  toggleAuthMode() {
    this.isRegisterMode = !this.isRegisterMode;
    this.authError = '';
    setTimeout(() => this.initGoogleButton(), 100);
  }

  onLogin() {
    this.authService.login(this.loginData).subscribe({
      next: () => {
        this.router.navigate(['/home']);
      },
      error: (err) => {
        this.authError = err.error?.message || 'Error al iniciar sesión';
      }
    });
  }

  onRegister() {
    this.authService.register(this.registerData).subscribe({
      next: () => {
        this.router.navigate(['/home']);
      },
      error: (err) => {
        this.authError = err.error?.message || 'Error al registrarse';
      }
    });
  }

  initGoogleButton() {
    if ((window as any).google) {
      (window as any).google.accounts.id.initialize({
        client_id: 'YOUR_GOOGLE_CLIENT_ID',
        callback: (response: any) => this.handleGoogleCredential(response)
      });
      const btn = document.getElementById('google-btn');
      if (btn) {
        (window as any).google.accounts.id.renderButton(btn, {
          theme: 'outline',
          size: 'large',
          width: '100%'
        });
      }
    }
  }

  handleGoogleCredential(response: any) {
    this.authService.googleLogin(response.credential).subscribe({
      next: () => this.router.navigate(['/home']),
      error: (err) => this.authError = err.error?.message || 'Error con Google Login'
    });
  }
}
