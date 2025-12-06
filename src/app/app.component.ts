import { Component, OnInit, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { AuthService } from './services/auth.service';

import { AlertModalComponent } from './components/alert-modal/alert-modal.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, AlertModalComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css'
})
export class AppComponent implements OnInit {
  title = 'rutas-tj';
  private authService = inject(AuthService);

  ngOnInit() {
    this.authService.loadUserFromStorage();
  }
}
