import { Injectable } from '@angular/core';
import { ResearchAssetItem } from '../models/research.models';
import { ResearchTemplateService } from './research-template.service';

@Injectable({ providedIn: 'root' })
export class ResearchExportService {
  constructor(private readonly templates: ResearchTemplateService) {}

  buildMarkdown(items: ResearchAssetItem[], generatedAt = new Date()): string {
    const dateLabel = this.formatDateLabel(generatedAt);
    const lines: string[] = [
      '# Datos actualizados de especies para ChatGPT',
      '',
      `Fecha de generación: ${dateLabel}`,
      '',
      '## Instrucciones',
      '',
      'Estos datos complementan el contexto de portafolio exportado desde frontend-inversion.',
      'Usar estos datos para analizar en profundidad las especies solicitadas.',
      'Si algún campo está vacío, considerarlo como no informado, no asumirlo.',
      '',
      '## Especies incluidas',
      '',
      '| Especie | Tipo | Símbolo búsqueda | Fuente | Última edición |',
      '| --- | --- | --- | --- | --- |'
    ];

    for (const item of items) {
      lines.push(
        `| ${this.escapeTable(item.portfolioSymbol)} | ${this.escapeTable(this.templates.templateLabel(item.kind))} | ${this.escapeTable(item.querySymbol)} | ${this.escapeTable(item.source)} | ${this.escapeTable(this.formatDateTime(item.updatedAt))} |`
      );
    }

    for (const item of items) {
      lines.push(
        '',
        `---`,
        '',
        `## ${item.portfolioSymbol}`,
        '',
        `Tipo: ${this.templates.templateLabel(item.kind)}`,
        `Símbolo búsqueda: ${item.querySymbol || 'N/D'}`,
        `Fuente: ${item.source}`,
        `Última edición: ${this.formatDateTime(item.updatedAt)}`,
        ''
      );

      for (const field of item.fields) {
        lines.push(`${field.label}: ${field.value ?? ''}`);
      }

      lines.push('', `Notas: ${item.notes ?? ''}`);
    }

    return lines.join('\n').trim() + '\n';
  }

  buildFilename(generatedAt = new Date()): string {
    return `datos-gpt-especies-${this.formatFileDate(generatedAt)}.md`;
  }

  private formatFileDate(date: Date): string {
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${year}-${month}-${day}`;
  }

  private formatDateLabel(date: Date): string {
    return new Intl.DateTimeFormat('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(date);
  }

  private formatDateTime(value: string | Date | null | undefined): string {
    const date = value instanceof Date ? value : value ? new Date(value) : null;
    if (!date || Number.isNaN(date.getTime())) {
      return 'N/D';
    }
    return new Intl.DateTimeFormat('es-AR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date);
  }

  private escapeTable(value: string): string {
    return String(value ?? '').replace(/\|/g, '\\|');
  }
}

