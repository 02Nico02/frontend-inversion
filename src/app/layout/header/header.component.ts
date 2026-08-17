import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { NavigationEnd, Router, RouterLink } from '@angular/router';
import { filter } from 'rxjs';
import { PortfolioStateService } from '../../core/services/portfolio-state.service';
import { PrivacyModeService } from '../../core/services/privacy-mode.service';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './header.component.html',
  styleUrls: ['./header.component.scss']
})
export class HeaderComponent {
  currentSection = 'Resumen';

  constructor(
    public readonly state: PortfolioStateService,
    public readonly privacyMode: PrivacyModeService,
    private readonly router: Router
  ) {
    this.currentSection = this.getSectionLabel(this.router.url);
    this.router.events.pipe(filter((event): event is NavigationEnd => event instanceof NavigationEnd)).subscribe((event) => {
      this.currentSection = this.getSectionLabel(event.urlAfterRedirects);
    });
  }

  togglePrivacy(): void {
    this.privacyMode.toggle();
  }

  goToValidation(): void {
    this.router.navigateByUrl('/datos-a-revisar');
  }

  clearImport(): void {
    this.state.reset();
  }

  fileLabel(fileName: string | null): string {
    return fileName || 'Sin archivo cargado';
  }

  statusLabel(status: string): string {
    switch (status) {
      case 'ready':
        return 'Listo';
      case 'loading':
        return 'Cargando';
      case 'warning':
        return 'Con advertencias';
      case 'error':
        return 'Con errores';
      default:
        return 'Sin datos';
    }
  }

  formatDate(date: string): string {
    return date;
  }

  private getSectionLabel(url: string): string {
    switch (url.split('?')[0]) {
      case '/resumen':
        return 'Resumen';
      case '/posiciones':
        return 'Posiciones';
      case '/decisiones':
        return 'Decisiones';
      case '/distribucion':
        return 'Distribución';
      case '/distribucion/simulador':
        return 'Simulador estratégico';
      case '/concentracion':
        return 'Concentración';
      case '/historico':
        return 'Histórico';
      case '/alertas':
        return 'Alertas';
      case '/datos-gpt':
        return 'Datos GPT';
      case '/datos-a-revisar':
        return 'Datos a revisar';
      case '/importacion':
        return 'Importación';
      case '/configuracion':
        return 'Ayuda y configuración';
      default:
        return 'Panel financiero';
    }
  }
}
