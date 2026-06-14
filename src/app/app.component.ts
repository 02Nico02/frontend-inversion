import { Component } from '@angular/core';
import { DashboardPageComponent } from './dashboard-page.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [DashboardPageComponent],
  template: `<app-dashboard-page></app-dashboard-page>`
})
export class AppComponent {}
