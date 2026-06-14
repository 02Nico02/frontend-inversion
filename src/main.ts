import { bootstrapApplication } from '@angular/platform-browser';
import { provideAnimations } from '@angular/platform-browser/animations';
import { AppComponent } from './app/app.component';
import { provideEchartsCore } from 'ngx-echarts';
import { echarts } from './app/core/charts/echarts-setup';

bootstrapApplication(AppComponent, {
  providers: [
    provideAnimations(),
    provideEchartsCore({ echarts })
  ]
}).catch((err) => console.error(err));
