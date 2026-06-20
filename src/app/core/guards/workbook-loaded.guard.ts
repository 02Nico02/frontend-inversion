import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { PortfolioStateService } from '../services/portfolio-state.service';

export const workbookLoadedGuard: CanActivateFn = () => {
  const state = inject(PortfolioStateService).snapshot;
  if (state.dataset && state.workbook && state.status !== 'empty') {
    return true;
  }

  return inject(Router).createUrlTree(['/importacion']);
};
