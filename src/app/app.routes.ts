import { Routes } from '@angular/router';
import { SummaryPageComponent } from './pages/summary-page.component';
import { DistributionPageComponent } from './pages/distribution-page.component';
import { PositionsPageComponent } from './pages/positions-page.component';
import { HistoricalPageComponent } from './pages/historical-page.component';
import { AlertsPageComponent } from './pages/alerts-page.component';
import { ConcentrationPageComponent } from './pages/concentration-page.component';
import { StrategyPageComponent } from './pages/strategy-page.component';
import { DataReviewPageComponent } from './pages/data-review-page.component';
import { ImportPageComponent } from './pages/import-page.component';
import { HelpPageComponent } from './pages/help-page.component';

export const appRoutes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'resumen' },
  { path: 'resumen', component: SummaryPageComponent },
  { path: 'distribucion', component: DistributionPageComponent },
  { path: 'posiciones', component: PositionsPageComponent },
  { path: 'historico', component: HistoricalPageComponent },
  { path: 'alertas', component: AlertsPageComponent },
  { path: 'concentracion', component: ConcentrationPageComponent },
  { path: 'estrategia', component: StrategyPageComponent },
  { path: 'datos-a-revisar', component: DataReviewPageComponent },
  { path: 'importacion', component: ImportPageComponent },
  { path: 'configuracion', component: HelpPageComponent },
  { path: '**', redirectTo: 'resumen' }
];

