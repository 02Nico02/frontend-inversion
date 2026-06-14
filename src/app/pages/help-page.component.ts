import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';

@Component({
  standalone: true,
  imports: [CommonModule],
  template: `
    <section class="page">
      <header class="page-header">
        <div>
          <p class="eyebrow">Configuración</p>
          <h2>Ayuda y limitaciones</h2>
        </div>
      </header>

      <article class="panel">
        <h3>Fuente de verdad</h3>
        <p>El Excel local es la única fuente de verdad. La app no usa backend ni persiste el workbook completo.</p>
      </article>

      <article class="panel">
        <h3>Monedas</h3>
        <p>ARS y USD se normalizan para análisis. Sin conversión mezcla monedas solo como referencia visual.</p>
      </article>

      <article class="panel">
        <h3>Limitaciones conocidas</h3>
        <ul>
          <li>No hay backend.</li>
          <li>No se convierten monedas automáticamente.</li>
          <li>Tabla35 requiere revisión de escala si los valores parecen extraños.</li>
        </ul>
      </article>
    </section>
  `,
  styles: [`
    .page { display: grid; gap: 1rem; }
    .page-header .eyebrow { margin: 0; color: var(--brand); text-transform: uppercase; letter-spacing: 0.18em; font-size: 0.72rem; }
    .page-header h2, .panel h3 { margin: 0.2rem 0 0; }
    .panel { background: var(--panel); border: 1px solid var(--panel-border); border-radius: var(--radius); box-shadow: var(--shadow); padding: 1rem; }
  `]
})
export class HelpPageComponent {}

