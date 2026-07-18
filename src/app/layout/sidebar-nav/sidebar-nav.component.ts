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
    { label: 'Distribucion', path: '/distribucion' },
    { label: 'Posiciones', path: '/posiciones' },
    { label: 'Historico', path: '/historico' },
    { label: 'Alertas', path: '/alertas' },
    { label: 'Concentracion', path: '/concentracion' },
    { label: 'Decisiones', path: '/decisiones' },
    { label: 'Estrategia', path: '/estrategia' },
    { label: 'Datos GPT', path: '/datos-gpt' },
    { label: 'Datos a revisar', path: '/datos-a-revisar' },
    { label: 'Importacion', path: '/importacion' },
    { label: 'Configuracion', path: '/configuracion' }
  ];
}
