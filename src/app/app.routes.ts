import { Routes } from '@angular/router';
import { SummaryPageComponent } from './features/summary/pages/summary-page/summary-page.component';
import { DistributionPageComponent } from './features/distribution/pages/distribution-page/distribution-page.component';
import { PositionsPageComponent } from './features/positions/pages/positions-page/positions-page.component';
import { PositionDetailPageComponent } from './features/positions/pages/position-detail-page/position-detail-page.component';
import { HistoricalPageComponent } from './features/historical/pages/historical-page/historical-page.component';
import { AlertsPageComponent } from './features/alerts/pages/alerts-page/alerts-page.component';
import { ConcentrationPageComponent } from './features/concentration/pages/concentration-page/concentration-page.component';
import { DecisionsPageComponent } from './features/decisions/pages/decisions-page/decisions-page.component';
import { StrategyPageComponent } from './features/strategy/pages/strategy-page/strategy-page.component';
import { DataReviewPageComponent } from './features/data-review/pages/data-review-page/data-review-page.component';
import { ResearchPageComponent } from './features/research/pages/research-page/research-page.component';
import { ImportPageComponent } from './features/import/pages/import-page/import-page.component';
import { HelpPageComponent } from './features/settings/pages/help-page/help-page.component';
import { workbookLoadedGuard } from './core/guards/workbook-loaded.guard';

export const appRoutes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'resumen' },
  { path: 'resumen', component: SummaryPageComponent, canActivate: [workbookLoadedGuard] },
  { path: 'distribucion', component: DistributionPageComponent, canActivate: [workbookLoadedGuard] },
  { path: 'posiciones/:symbol', component: PositionDetailPageComponent, canActivate: [workbookLoadedGuard] },
  { path: 'posiciones', component: PositionsPageComponent, canActivate: [workbookLoadedGuard] },
  { path: 'historico', component: HistoricalPageComponent, canActivate: [workbookLoadedGuard] },
  { path: 'alertas', component: AlertsPageComponent, canActivate: [workbookLoadedGuard] },
  { path: 'concentracion', component: ConcentrationPageComponent, canActivate: [workbookLoadedGuard] },
  { path: 'decisiones', component: DecisionsPageComponent, canActivate: [workbookLoadedGuard] },
  { path: 'estrategia', component: StrategyPageComponent, canActivate: [workbookLoadedGuard] },
  { path: 'datos-a-revisar', component: DataReviewPageComponent, canActivate: [workbookLoadedGuard] },
  { path: 'datos-gpt', component: ResearchPageComponent, canActivate: [workbookLoadedGuard] },
  { path: 'importacion', component: ImportPageComponent },
  { path: 'configuracion', component: HelpPageComponent, canActivate: [workbookLoadedGuard] },
  { path: '**', redirectTo: 'importacion' }
];
