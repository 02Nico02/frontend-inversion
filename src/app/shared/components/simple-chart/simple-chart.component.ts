import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { NgxEchartsDirective } from 'ngx-echarts';
import type { ECharts, EChartsCoreOption } from 'echarts/core';
import { ChartPoint, SeriesPoint } from '../../../core/services/chart-data.service';
import { ChartConfigService } from '../../../core/services/chart-config.service';

@Component({
  selector: 'app-simple-chart',
  standalone: true,
  imports: [CommonModule, NgxEchartsDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './simple-chart.component.html',
  styleUrls: ['./simple-chart.component.scss'],
})
export class SimpleChartComponent {
  private _title = '';
  private _subtitle = '';
  private _mode: 'bars' | 'line' = 'bars';
  private _points: Array<ChartPoint | SeriesPoint> = [];
  private _currency = 'UNKNOWN';
  private _valueKind: 'number' | 'money' | 'percent' = 'number';
  private _topN = 10;
  private _includeOther = true;
  private _showAverage = true;

  chartOptions: EChartsCoreOption = {};
  chartInstance: ECharts | null = null;

  constructor(private readonly chartConfig: ChartConfigService) {}

  @Input()
  set title(value: string) {
    this._title = value ?? '';
    this.rebuildOptions();
  }
  get title(): string {
    return this._title;
  }

  @Input()
  set subtitle(value: string) {
    this._subtitle = value ?? '';
    this.rebuildOptions();
  }
  get subtitle(): string {
    return this._subtitle;
  }

  @Input()
  set mode(value: 'bars' | 'line') {
    this._mode = value ?? 'bars';
    this.rebuildOptions();
  }
  get mode(): 'bars' | 'line' {
    return this._mode;
  }

  @Input()
  set points(value: Array<ChartPoint | SeriesPoint>) {
    this._points = value ?? [];
    this.rebuildOptions();
  }
  get points(): Array<ChartPoint | SeriesPoint> {
    return this._points;
  }

  @Input()
  set currency(value: string) {
    this._currency = value ?? 'UNKNOWN';
    this.rebuildOptions();
  }
  get currency(): string {
    return this._currency;
  }

  @Input()
  set valueKind(value: 'number' | 'money' | 'percent') {
    this._valueKind = value ?? 'number';
    this.rebuildOptions();
  }
  get valueKind(): 'number' | 'money' | 'percent' {
    return this._valueKind;
  }

  @Input()
  set topN(value: number) {
    this._topN = Number.isFinite(value) ? value : 10;
    this.rebuildOptions();
  }
  get topN(): number {
    return this._topN;
  }

  @Input()
  set includeOther(value: boolean) {
    this._includeOther = value !== false;
    this.rebuildOptions();
  }
  get includeOther(): boolean {
    return this._includeOther;
  }

  @Input()
  set showAverage(value: boolean) {
    this._showAverage = value !== false;
    this.rebuildOptions();
  }
  get showAverage(): boolean {
    return this._showAverage;
  }

  get seriesHint(): string {
    const count = this.points.length;
    if (count > 300) {
      return 'Serie grande: se aplica sampling visual y zoom para explorar sin saturar puntos.';
    }
    if (count > 80) {
      return 'Serie media: se reducen puntos permanentes para mejorar la lectura.';
    }
    return 'Serie corta: se muestran los puntos principales.';
  }

  get showSeriesHint(): boolean {
    return this.points.length > 0;
  }

  onChartInit(instance: ECharts): void {
    this.chartInstance = instance;
  }

  resetZoom(): void {
    this.chartInstance?.dispatchAction({ type: 'restore' });
  }

  private rebuildOptions(): void {
    this.chartOptions = this._mode === 'bars'
      ? this.chartConfig.barChart({
          title: this._title,
          subtitle: this._subtitle,
          points: this._points as ChartPoint[],
          currency: this._currency,
          topN: this._topN,
          includeOther: this._includeOther
        })
      : this.chartConfig.lineChart({
          title: this._title,
          subtitle: this._subtitle,
          points: this._points as SeriesPoint[],
          currency: this._currency,
          valueKind: this._valueKind,
          showAverage: this._showAverage
        });
  }
}
