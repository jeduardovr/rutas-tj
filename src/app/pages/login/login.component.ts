import { Component, OnInit, NgZone } from '@angular/core';
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

  constructor(
    public authService: AuthService,
    private router: Router,
    private ngZone: NgZone
  ) { }

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
        client_id: '661867927943-39can6prp0i1hf1kagc8t8him7i492eo.apps.googleusercontent.com',
        callback: (response: any) => {
          this.ngZone.run(() => {
            this.handleGoogleCredential(response);
          });
        }
      });
      const btn = document.getElementById('google-btn');
      if (btn) {
        (window as any).google.accounts.id.renderButton(btn, {
          theme: 'outline',
          size: 'large'
        });
      }
    }
  }

  handleGoogleCredential(response: any) {
    const mode = this.isRegisterMode ? 'register' : 'login';
    this.authService.googleLogin(response.credential, mode).subscribe({
      next: () => this.router.navigate(['/home']),
      error: (err) => this.authError = err.error?.message || 'Error con Google Login'
    });
  }
}
