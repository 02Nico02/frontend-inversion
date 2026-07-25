import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';

interface NavItem {
  label: string;
  path: string;
}

interface NavGroup {
  label: string;
  items: NavItem[];
}

@Component({
  selector: 'app-sidebar-nav',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive],
  templateUrl: './sidebar-nav.component.html',
  styleUrls: ['./sidebar-nav.component.scss'],
})
export class SidebarNavComponent {
  readonly groups: NavGroup[] = [
    {
      label: 'Principal',
      items: [
        { label: 'Resumen', path: '/resumen' },
        { label: 'Posiciones', path: '/posiciones' },
        { label: 'Decisiones', path: '/decisiones' }
      ]
    },
    {
      label: 'Análisis',
      items: [
        { label: 'Distribución', path: '/distribucion' },
        { label: 'Concentración', path: '/concentracion' },
        { label: 'Histórico', path: '/historico' },
        { label: 'Alertas', path: '/alertas' }
      ]
    },
    {
      label: 'Herramientas',
      items: [
        { label: 'Datos GPT', path: '/datos-gpt' },
        { label: 'Datos a revisar', path: '/datos-a-revisar' },
        { label: 'Importación', path: '/importacion' }
      ]
    },
    {
      label: 'Sistema',
      items: [{ label: 'Configuración', path: '/configuracion' }]
    }
  ];
}
