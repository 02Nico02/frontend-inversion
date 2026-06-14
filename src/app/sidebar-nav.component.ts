import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';

interface NavItem {
  label: string;
  path: string;
}

@Component({
  selector: 'app-sidebar-nav',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive],
  template: `
    <nav class="sidebar">
      <a *ngFor="let item of items" [routerLink]="item.path" routerLinkActive="active" class="nav-item">
        <span>{{ item.label }}</span>
      </a>
    </nav>
  `,
  styles: [`
    .sidebar {
      display: grid;
      gap: 0.35rem;
      padding: 1rem 0.8rem;
    }
    .nav-item {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0.75rem 0.9rem;
      border-radius: 14px;
      border: 1px solid transparent;
      color: var(--muted);
      text-decoration: none;
      background: rgba(255, 255, 255, 0.02);
    }
    .nav-item.active {
      color: var(--text);
      border-color: rgba(77, 210, 200, 0.35);
      background: rgba(77, 210, 200, 0.08);
    }
  `]
})
export class SidebarNavComponent {
  readonly items: NavItem[] = [
    { label: 'Resumen', path: '/resumen' },
    { label: 'Distribución', path: '/distribucion' },
    { label: 'Posiciones', path: '/posiciones' },
    { label: 'Histórico', path: '/historico' },
    { label: 'Alertas', path: '/alertas' },
    { label: 'Concentración', path: '/concentracion' },
    { label: 'Estrategia', path: '/estrategia' },
    { label: 'Datos a revisar', path: '/datos-a-revisar' },
    { label: 'Importación', path: '/importacion' },
    { label: 'Configuración', path: '/configuracion' }
  ];
}

