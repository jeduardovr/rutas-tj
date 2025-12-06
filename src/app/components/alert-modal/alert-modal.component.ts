import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AlertService } from '../../services/alert.service';

@Component({
    selector: 'app-alert-modal',
    standalone: true,
    imports: [CommonModule],
    templateUrl: './alert-modal.component.html',
    styleUrls: ['./alert-modal.component.css']
})
export class AlertModalComponent {
    constructor(public alertService: AlertService) { }

    onConfirm() {
        const state = this.alertService.alertState();
        if (state && state.resolve) {
            state.resolve(true); // Resolvemos promesa con true (para confirmaciones) o generico para alerts
        }
        this.alertService.close();
    }

    onCancel() {
        const state = this.alertService.alertState();
        if (state && state.resolve) {
            state.resolve(false); // Resolvemos promesa con false
        }
        this.alertService.close();
    }
}
