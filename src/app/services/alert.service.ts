import { Injectable, signal } from '@angular/core';

export interface AlertOptions {
    title: string;
    message: string;
    type: 'success' | 'error' | 'warning' | 'info';
    confirmText?: string;
    cancelText?: string;
}

export interface AlertState extends AlertOptions {
    id: number;
    isConfirm?: boolean;
    resolve?: (value: boolean) => void;
}

@Injectable({
    providedIn: 'root'
})
export class AlertService {
    alertState = signal<AlertState | null>(null);

    constructor() { }

    /**
     * Muestra una alerta informativa (como un alert() bonito)
     */
    showAlert(title: string, message: string, type: 'success' | 'error' | 'warning' | 'info' = 'info'): Promise<void> {
        return new Promise((resolve) => {
            this.alertState.set({
                id: Date.now(),
                title,
                message,
                type,
                resolve: () => resolve()
            });
        });
    }

    /**
     * Muestra un diálogo de confirmación (como un confirm() bonito)
     */
    confirm(title: string, message: string, confirmText = 'Aceptar', cancelText = 'Cancelar', type: 'warning' | 'info' = 'warning'): Promise<boolean> {
        return new Promise((resolve) => {
            this.alertState.set({
                id: Date.now(),
                title,
                message,
                type,
                isConfirm: true,
                confirmText,
                cancelText,
                resolve: (val) => resolve(val)
            });
        });
    }

    success(title: string, message: string) {
        return this.showAlert(title, message, 'success');
    }

    error(title: string, message: string) {
        return this.showAlert(title, message, 'error');
    }

    warning(title: string, message: string) {
        return this.showAlert(title, message, 'warning');
    }

    info(title: string, message: string) {
        return this.showAlert(title, message, 'info');
    }

    close() {
        this.alertState.set(null);
    }
}
