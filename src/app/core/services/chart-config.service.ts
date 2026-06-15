import { Injectable } from '@angular/core';
import type { EChartsCoreOption } from 'echarts/core';
import { ChartPoint, SeriesPoint } from './chart-data.service';
import { CurrencyMapperService } from './currency-mapper.service';
import { parseExcelDate } from '../utils/value-parsing.utils';

type ValueKind = 'number' | 'money' | 'percent';

interface LineChartConfig {
  title: string;
  subtitle?: string;
  points: SeriesPoint[];
  currency?: string;
  valueKind?: ValueKind;
  showAverage?: boolean;
}

interface BarChartConfig {
  title: string;
  subtitle?: string;
  points: ChartPoint[];
  currency?: string;
  topN?: number;
  includeOther?: boolean;
}

interface LineDatum {
  label: string;
  value: number;
  date?: string | null;
  changeAmount?: number | null;
  changePercent?: number | null;
}

interface BarDatum {
  label: string;
  value: number;
  percentage?: number;
  count?: number;
}

@Injectable({ providedIn: 'root' })
export class ChartConfigService {
  private readonly colors = ['#4dd2c8', '#8b5cf6', '#60a5fa', '#f59e0b', '#22c55e', '#f97316'];

  constructor(private readonly currencyMapper: CurrencyMapperService) {}

  lineChart(config: LineChartConfig): EChartsCoreOption {
    const points = this.normalizeLinePoints(config.points);
    const currency = config.currency ?? 'UNKNOWN';
    const valueKind = config.valueKind ?? 'number';
    const manyPoints = points.length > 80;
    const hugeSeries = points.length > 300;
    const maxPoint = points.reduce<LineDatum | null>((best, current) => (best === null || current.value > best.value ? current : best), null);
    const minPoint = points.reduce<LineDatum | null>((best, current) => (best === null || current.value < best.value ? current : best), null);
    const latestPoint = points.at(-1) ?? null;
    const average = config.showAverage === false || !points.length ? null : points.reduce((sum, item) => sum + item.value, 0) / points.length;
    const showZoom = points.length > 20;

    return {
      backgroundColor: 'transparent',
      color: this.colors,
      animationDuration: 300,
      grid: {
        left: 48,
        right: 24,
        top: 56,
        bottom: showZoom ? 72 : 44
      },
      tooltip: this.buildLineTooltip(currency, valueKind),
      toolbox: {
        right: 10,
        top: 10,
        feature: {
          restore: {},
          saveAsImage: {
            pixelRatio: 2
          }
        }
      },
      xAxis: {
        type: 'category',
        boundaryGap: false,
        data: points.map((point) => point.label),
        axisLine: {
          lineStyle: {
            color: 'rgba(148, 163, 184, 0.35)'
          }
        },
        axisTick: {
          show: false
        },
        axisLabel: {
          color: '#9db0d1',
          hideOverlap: true,
          formatter: (value: string) => value
        }
      },
      yAxis: {
        type: 'value',
        splitNumber: 4,
        axisLabel: {
          color: '#9db0d1',
          formatter: (value: number) => this.formatAxisValue(value, valueKind, currency)
        },
        splitLine: {
          lineStyle: {
            color: 'rgba(255, 255, 255, 0.08)'
          }
        },
        axisLine: {
          lineStyle: {
            color: 'rgba(148, 163, 184, 0.25)'
          }
        }
      },
      dataZoom: showZoom
        ? [
            {
              type: 'inside',
              xAxisIndex: 0,
              zoomOnMouseWheel: true,
              moveOnMouseWheel: true,
              moveOnMouseMove: true
            },
            {
              type: 'slider',
              xAxisIndex: 0,
              height: 22,
              bottom: 18,
              borderColor: 'rgba(148, 163, 184, 0.2)',
              backgroundColor: 'rgba(255, 255, 255, 0.04)',
              fillerColor: 'rgba(77, 210, 200, 0.22)',
              handleStyle: {
                color: '#4dd2c8',
                borderColor: '#4dd2c8'
              },
              textStyle: {
                color: '#9db0d1'
              }
            }
          ]
        : undefined,
      series: [
        {
          type: 'line',
          name: config.subtitle ?? config.title,
          data: points.map((point) => point.value),
          smooth: true,
          showSymbol: !manyPoints,
          symbol: 'circle',
          symbolSize: manyPoints ? 5 : 8,
          sampling: hugeSeries ? 'lttb' : undefined,
          lineStyle: {
            width: 3,
            color: this.colors[0]
          },
          itemStyle: {
            color: this.colors[1]
          },
          areaStyle: {
            color: 'rgba(77, 210, 200, 0.16)'
          },
          emphasis: {
            focus: 'series'
          },
          markPoint: {
            symbolSize: manyPoints ? 16 : 18,
            itemStyle: {
              color: '#8b5cf6',
              borderColor: 'rgba(255, 255, 255, 0.55)',
              borderWidth: 1
            },
            label: {
              color: '#e5eefc',
              fontSize: 10,
              fontWeight: 600,
              distance: 4
            },
            data: this.buildLineMarks(maxPoint, minPoint, latestPoint)
          },
          markLine: average !== null
            ? {
                symbol: 'none',
                lineStyle: {
                  type: 'dashed',
                  color: 'rgba(148, 163, 184, 0.5)'
                },
                label: {
                  color: '#9db0d1',
                  formatter: 'Promedio'
                },
                data: [{ yAxis: average }]
              }
            : undefined
        }
      ]
    };
  }

  barChart(config: BarChartConfig): EChartsCoreOption {
    const topN = Math.max(1, config.topN ?? 10);
    const bars = this.normalizeBars(config.points, topN, config.includeOther ?? true);
    const currency = config.currency ?? 'UNKNOWN';
    const maxValue = bars.length ? Math.max(...bars.map((item) => item.value)) : 0;
    const selectedCount = Math.min(topN, bars.some((item) => item.label === 'Otros') ? bars.length - 1 : bars.length);
    const hasOther = bars.some((item) => item.label === 'Otros');

    return {
      backgroundColor: 'transparent',
      color: this.colors,
      grid: {
        left: 24,
        right: 128,
        top: 24,
        bottom: 24
      },
      tooltip: this.buildBarTooltip(currency),
      xAxis: {
        type: 'value',
        axisLabel: {
          color: '#9db0d1',
          formatter: (value: number) => this.formatAxisValue(value, 'money', currency)
        },
        splitLine: {
          lineStyle: {
            color: 'rgba(255, 255, 255, 0.08)'
          }
        },
        axisLine: {
          lineStyle: {
            color: 'rgba(148, 163, 184, 0.25)'
          }
        }
      },
      yAxis: {
        type: 'category',
        inverse: true,
        data: bars.map((item) => item.label),
        axisLabel: {
          color: '#e5eefc',
          width: 180,
          overflow: 'truncate'
        },
        axisTick: {
          show: false
        },
        axisLine: {
          lineStyle: {
            color: 'rgba(148, 163, 184, 0.25)'
          }
        }
      },
      series: [
        {
          type: 'bar',
          data: bars.map((item) => ({
            value: item.value,
            label: item.label,
            percentage: item.percentage,
            count: item.count
          })),
          barWidth: '58%',
          showBackground: true,
          backgroundStyle: {
            color: 'rgba(255, 255, 255, 0.06)'
          },
          itemStyle: {
            borderRadius: [0, 999, 999, 0],
            color: {
              type: 'linear',
              x: 0,
              y: 0,
              x2: 1,
              y2: 0,
              colorStops: [
                { offset: 0, color: '#4dd2c8' },
                { offset: 1, color: '#8b5cf6' }
              ]
            }
          },
          label: {
            show: true,
            position: 'right',
            distance: 10,
            color: '#e5eefc',
            fontSize: 11,
            width: 120,
            overflow: 'truncate',
            formatter: (params: { value: number; data?: BarDatum }) => {
              const data = params.data ?? null;
              const value = this.formatMoney(params.value, currency);
              const percentage = data?.percentage !== undefined ? ` · ${this.formatPercent(data.percentage)}` : '';
              return `${value}${percentage}`;
            }
          }
        }
      ],
      graphic: bars.length
        ? [
            {
              type: 'text',
              left: 8,
              top: 6,
              style: {
                fill: '#9db0d1',
                fontSize: 11,
                text: `Top ${selectedCount}${hasOther ? ' + Otros' : ''} · max ${this.formatMoney(maxValue, currency)}`
              }
            }
          ]
        : undefined
    };
  }

  private buildLineTooltip(currency: string, valueKind: ValueKind) {
    return {
      trigger: 'axis',
      confine: true,
      backgroundColor: 'rgba(8, 12, 24, 0.96)',
      borderColor: 'rgba(148, 163, 184, 0.18)',
      textStyle: {
        color: '#e5eefc'
      },
      axisPointer: {
        type: 'line'
      },
      formatter: (params: unknown) => {
        const entries = Array.isArray(params) ? params : [params];
        const first = entries[0] as { data?: number; axisValueLabel?: string; seriesName?: string; dataIndex?: number };
        const dataIndex = typeof first?.dataIndex === 'number' ? first.dataIndex : null;
        const data = dataIndex !== null ? this.lastLinePoints[dataIndex] ?? null : null;
        const lines: string[] = [];
        if (first?.seriesName) {
          lines.push(`<strong>${first.seriesName}</strong>`);
        }
        if (data?.label) {
          lines.push(`Fecha: ${data.label}`);
        } else if (first?.axisValueLabel) {
          lines.push(`Fecha: ${first.axisValueLabel}`);
        }
        if (typeof data?.value === 'number') {
          lines.push(`Valor: ${this.formatAxisValue(data.value, valueKind, currency)}`);
        }
        if (typeof data?.changeAmount === 'number') {
          lines.push(`Cambio: ${this.formatAxisValue(data.changeAmount, valueKind, currency)}`);
        }
        if (typeof data?.changePercent === 'number') {
          lines.push(`Cambio %: ${this.formatPercent(data.changePercent)}`);
        }
        return lines.join('<br/>');
      }
    };
  }

  private buildBarTooltip(currency: string) {
    return {
      trigger: 'item',
      confine: true,
      backgroundColor: 'rgba(8, 12, 24, 0.96)',
      borderColor: 'rgba(148, 163, 184, 0.18)',
      textStyle: {
        color: '#e5eefc'
      },
      formatter: (params: unknown) => {
        const item = params as { data?: BarDatum; name?: string; value?: number };
        const data = item.data ?? null;
        const label = data?.label ?? item.name ?? 'Sin categoría';
        const value = typeof item.value === 'number' ? item.value : data?.value ?? 0;
        const lines = [
          `<strong>${label}</strong>`,
          `Monto: ${this.formatMoney(value, currency)}`
        ];
        if (typeof data?.percentage === 'number') {
          lines.push(`Peso: ${this.formatPercent(data.percentage)}`);
        }
        if (typeof data?.count === 'number') {
          lines.push(`Cantidad de especies: ${data.count}`);
        }
        return lines.join('<br/>');
      }
    };
  }

  private buildLineMarks(maxPoint: LineDatum | null, minPoint: LineDatum | null, latestPoint: LineDatum | null): Array<Record<string, unknown>> {
    const marks: Array<Record<string, unknown>> = [];
    if (maxPoint) {
      marks.push({ name: 'Máximo', value: maxPoint.value, xAxis: maxPoint.label, yAxis: maxPoint.value });
    }
    if (minPoint) {
      marks.push({ name: 'Mínimo', value: minPoint.value, xAxis: minPoint.label, yAxis: minPoint.value });
    }
    if (latestPoint) {
      marks.push({ name: 'Último', value: latestPoint.value, xAxis: latestPoint.label, yAxis: latestPoint.value });
    }
    return marks;
  }

  private normalizeLinePoints(points: SeriesPoint[]): LineDatum[] {
    this.lastLinePoints = [...points]
      .filter((point) => point.value !== null && point.value !== undefined)
      .map((point) => ({
        label: point.label || this.formatDate(point.date),
        value: Number(point.value ?? 0),
        date: point.date ?? null,
        changeAmount: point.changeAmount ?? null,
        changePercent: point.changePercent ?? null
      }))
      .filter((point) => !!point.label);
    return this.lastLinePoints;
  }

  private normalizeBars(points: ChartPoint[], topN: number, includeOther: boolean): BarDatum[] {
    const sorted = [...points]
      .filter((point) => point.value !== null && point.value !== undefined)
      .sort((a, b) => Number(b.value ?? 0) - Number(a.value ?? 0));
    const selected = sorted.slice(0, topN);
    const remainder = sorted.slice(topN);
    const total = sorted.reduce((sum, item) => sum + Number(item.value ?? 0), 0);
    const bars = selected.map((item) => ({
      label: item.label,
      value: Number(item.value ?? 0),
      percentage: total > 0 ? ((Number(item.value ?? 0)) / total) * 100 : item.percentage ?? 0,
      count: item.count ?? 0
    }));
    if (includeOther && remainder.length) {
      const otherValue = remainder.reduce((sum, item) => sum + Number(item.value ?? 0), 0);
      const otherCount = remainder.reduce((sum, item) => sum + (item.count ?? 0), 0);
      bars.push({
        label: 'Otros',
        value: otherValue,
        percentage: total > 0 ? (otherValue / total) * 100 : 0,
        count: otherCount
      });
    }
    return bars;
  }

  private formatMoney(value: number | null | undefined, currency: string): string {
    return this.currencyMapper.formatCurrency(value, currency);
  }

  private formatPercent(value: number | null | undefined): string {
    return this.currencyMapper.formatPercentage(value);
  }

  private formatAxisValue(value: number, kind: ValueKind, currency: string): string {
    if (kind === 'percent') {
      return this.formatPercent(value);
    }
    if (kind === 'money') {
      return this.formatMoney(value, currency);
    }
    return new Intl.NumberFormat('es-AR', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2
    }).format(value);
  }

  private formatDate(value: string | null | undefined): string {
    if (!value) {
      return '';
    }
    const date = parseExcelDate(value);
    return date ? new Intl.DateTimeFormat('es-AR').format(date) : value;
  }

  private lastLinePoints: LineDatum[] = [];
}
