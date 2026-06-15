import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { NavigationEnd, Router, RouterLink } from '@angular/router';
import { filter, Subscription } from 'rxjs';
import { PortfolioStateService } from '../../core/services/portfolio-state.service';
import { PrivacyModeService } from '../../core/services/privacy-mode.service';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './header.component.html',
  styleUrls: ['./header.component.scss'],
})
export class HeaderComponent implements OnInit, OnDestroy {
  currentSection = 'Resumen';
  private subscription?: Subscription;

  constructor(
    public readonly state: PortfolioStateService,
    public readonly privacyMode: PrivacyModeService,
    private readonly router: Router
  ) {}

  ngOnInit(): void {
    this.currentSection = this.sectionFromUrl(this.router.url);
    this.subscription = this.router.events.pipe(filter((event): event is NavigationEnd => event instanceof NavigationEnd)).subscribe((event) => {
      this.currentSection = this.sectionFromUrl(event.urlAfterRedirects);
    });
  }

  ngOnDestroy(): void {
    this.subscription?.unsubscribe();
  }

  summaryText(snapshot: { status: string; workbook: { validation: { detectedTables: unknown[] } } | null; validationWarnings: string[]; validationErrors: string[] }): string {
    const tables = snapshot.workbook?.validation.detectedTables.length ?? 0;
    const warnings = snapshot.validationWarnings.length;
    const errors = snapshot.validationErrors.length;
    return `Workbook · ${tables} tablas detectadas · ${warnings} advertencias · ${errors} errores`;
  }

  formatDate(value: string): string {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat('es-AR', { dateStyle: 'short', timeStyle: 'short' }).format(date);
  }

  goToValidation(): void {
    this.router.navigateByUrl('/datos-a-revisar');
  }

  clearImport(): void {
    this.state.reset();
    this.router.navigateByUrl('/importacion');
  }

  togglePrivacy(): void {
    this.privacyMode.toggle();
  }

  private sectionFromUrl(url: string): string {
    switch (url.split('?')[0]) {
      case '/distribucion': return 'Distribución';
      case '/posiciones': return 'Posiciones';
      case '/historico': return 'Histórico';
      case '/alertas': return 'Alertas';
      case '/concentracion': return 'Concentración';
      case '/estrategia': return 'Estrategia';
      case '/datos-a-revisar': return 'Datos a revisar';
      case '/importacion': return 'Importación';
      case '/configuracion': return 'Configuración';
      default: return 'Resumen';
    }
  }
}
