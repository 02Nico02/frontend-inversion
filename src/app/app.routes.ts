import { Routes } from '@angular/router';
import { SummaryPageComponent } from './features/summary/pages/summary-page/summary-page.component';
import { DistributionPageComponent } from './features/distribution/pages/distribution-page/distribution-page.component';
import { PositionsPageComponent } from './features/positions/pages/positions-page/positions-page.component';
import { PositionDetailPageComponent } from './features/positions/pages/position-detail-page/position-detail-page.component';
import { HistoricalPageComponent } from './features/historical/pages/historical-page/historical-page.component';
import { AlertsPageComponent } from './features/alerts/pages/alerts-page/alerts-page.component';
import { ConcentrationPageComponent } from './features/concentration/pages/concentration-page/concentration-page.component';
import { StrategyPageComponent } from './features/strategy/pages/strategy-page/strategy-page.component';
import { DataReviewPageComponent } from './features/data-review/pages/data-review-page/data-review-page.component';
import { ImportPageComponent } from './features/import/pages/import-page/import-page.component';
import { HelpPageComponent } from './features/settings/pages/help-page/help-page.component';

export const appRoutes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'resumen' },
  { path: 'resumen', component: SummaryPageComponent },
  { path: 'distribucion', component: DistributionPageComponent },
  { path: 'posiciones/:symbol', component: PositionDetailPageComponent },
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
