import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

const STORAGE_KEY = 'frontend-inversion.privacy-mode';

@Injectable({ providedIn: 'root' })
export class PrivacyModeService {
  private readonly subject = new BehaviorSubject<boolean>(this.readInitialState());
  readonly enabled$ = this.subject.asObservable();

  get enabled(): boolean {
    return this.subject.value;
  }

  setEnabled(value: boolean): void {
    const next = Boolean(value);
    this.subject.next(next);
    this.writeState(next);
  }

  toggle(): void {
    this.setEnabled(!this.enabled);
  }

  maskText(value: string): string {
    return this.enabled ? 'Oculto' : value;
  }

  private readInitialState(): boolean {
    try {
      return localStorage.getItem(STORAGE_KEY) === 'true';
    } catch {
      return false;
    }
  }

  private writeState(value: boolean): void {
    try {
      localStorage.setItem(STORAGE_KEY, String(value));
    } catch {
      // Ignore storage failures and keep the in-memory state.
    }
  }
}
