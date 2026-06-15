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
  templateUrl: './sidebar-nav.component.html',
  styleUrls: ['./sidebar-nav.component.scss'],
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

