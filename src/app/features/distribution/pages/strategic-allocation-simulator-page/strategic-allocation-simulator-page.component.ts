import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { StrategicAllocationAsset, StrategicSectorObjective } from '../../../../core/models/portfolio.models';
import { CurrencyMapperService } from '../../../../core/services/currency-mapper.service';
import { PortfolioAppState, PortfolioStateService } from '../../../../core/services/portfolio-state.service';

type SimulationOperationType = 'buy' | 'sell';
type StrategicAllocationStatus = 'Falta peso' | 'Sobrepeso' | 'En rango' | 'Sin datos';

interface StrategicSimulationOperation {
  id: string;
  type: SimulationOperationType;
  symbol: string;
  macroSector: string;
  amountArs: number;
}

interface StrategicSimulationForm {
  type: SimulationOperationType;
  symbol: string;
  amountArs: number | null;
}

interface StrategicProjectionRow {
  macroSector: string;
  targetPercent: number | null;
  realValueArs: number;
  projectedValueArs: number;
  realPercent: number | null;
  projectedPercent: number | null;
  realDifferencePercent: number | null;
  projectedDifferencePercent: number | null;
  changePercentPoints: number | null;
  realStatus: StrategicAllocationStatus;
  projectedStatus: StrategicAllocationStatus;
}

interface StrategicProjectionView {
  assets: StrategicAllocationAsset[];
  rows: StrategicProjectionRow[];
  totalRealArs: number;
  totalProjectedArs: number;
  operationsCount: number;
  improvingRows: StrategicProjectionRow[];
  worseningRows: StrategicProjectionRow[];
  inRangeRows: StrategicProjectionRow[];
  symbolProjectedValues: Map<string, number>;
  warnings: string[];
}

@Component({
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './strategic-allocation-simulator-page.component.html',
  styleUrls: ['./strategic-allocation-simulator-page.component.scss']
})
export class StrategicAllocationSimulatorPageComponent implements OnInit {
  readonly storageKey = 'frontend-inversion.strategic-allocation-simulator';

  form: StrategicSimulationForm = {
    type: 'buy',
    symbol: '',
    amountArs: null
  };

  operations: StrategicSimulationOperation[] = [];
  errorMessage: string | null = null;

  constructor(
    public readonly state: PortfolioStateService,
    private readonly currencyMapper: CurrencyMapperService
  ) {
    this.operations = this.loadOperations();
  }

  ngOnInit(): void {
    this.ensureDefaultSymbol();
  }

  projection(snapshot: PortfolioAppState): StrategicProjectionView {
    const assets = this.availableAssets(snapshot);
    const objectives = this.availableObjectives(snapshot);

    if (!assets.length || !objectives.length) {
      return {
        assets,
        rows: [],
        totalRealArs: 0,
        totalProjectedArs: 0,
        operationsCount: this.operations.length,
        improvingRows: [],
        worseningRows: [],
        inRangeRows: [],
        symbolProjectedValues: new Map<string, number>(),
        warnings: []
      };
    }

    const normalizedAssets = assets
      .map((asset) => ({
        asset,
        symbol: this.normalizeSymbol(asset.symbol),
        macroSector: this.normalizeSector(asset.macroSector),
        valueArs: this.safeNumber(asset.currentValueArs)
      }))
      .filter((item) => item.symbol && item.macroSector);

    const objectiveBySector = new Map(
      objectives.map((objective) => [this.normalizeSector(objective.macroSector), objective] as const)
    );
    const assetValueBySector = new Map<string, number>();
    const sectorBySymbol = new Map<string, string>();
    const symbolProjectedValues = new Map<string, number>();

    for (const item of normalizedAssets) {
      assetValueBySector.set(item.macroSector, (assetValueBySector.get(item.macroSector) ?? 0) + item.valueArs);
      sectorBySymbol.set(item.symbol, item.macroSector);
      symbolProjectedValues.set(item.symbol, item.valueArs);
    }

    const sectors = new Set<string>();
    objectiveBySector.forEach((_, sector) => sectors.add(sector));
    assetValueBySector.forEach((_, sector) => sectors.add(sector));

    const baseRows = Array.from(sectors).map((macroSector) => {
      const objective = objectiveBySector.get(macroSector) ?? null;
      const realValueArs = objective?.currentValueArs ?? assetValueBySector.get(macroSector) ?? 0;
      const targetPercent = objective?.targetPercent ?? null;
      const realPercent = objective?.currentPercent ?? (this.totalBaseValue(sectors, objectiveBySector, assetValueBySector) > 0
        ? (realValueArs / this.totalBaseValue(sectors, objectiveBySector, assetValueBySector)) * 100
        : null);
      return {
        macroSector,
        targetPercent,
        realValueArs,
        realPercent,
        realDifferencePercent: this.differencePercent(targetPercent, realPercent),
        realStatus: this.statusFor(this.differencePercent(targetPercent, realPercent))
      };
    });

    const totalRealArs = baseRows.reduce((sum, row) => sum + row.realValueArs, 0);
    const sectorProjectedValues = new Map(baseRows.map((row) => [row.macroSector, row.realValueArs] as const));
    const warnings: string[] = [];

    for (const operation of this.operations) {
      const symbol = this.normalizeSymbol(operation.symbol);
      const sector = sectorBySymbol.get(symbol);
      if (!sector) {
        warnings.push(`La especie ${operation.symbol} no existe en la asignación estratégica cargada.`);
        continue;
      }

      const currentSymbolValue = symbolProjectedValues.get(symbol) ?? 0;
      const currentSectorValue = sectorProjectedValues.get(sector) ?? 0;

      if (operation.type === 'sell' && operation.amountArs > currentSymbolValue + 0.0001) {
        warnings.push(`No se puede vender ${this.formatMoney(operation.amountArs)} de ${operation.symbol} porque supera el valor disponible.`);
        continue;
      }

      const delta = operation.type === 'buy' ? operation.amountArs : -operation.amountArs;
      symbolProjectedValues.set(symbol, currentSymbolValue + delta);
      sectorProjectedValues.set(sector, currentSectorValue + delta);
    }

    const totalProjectedArs = Array.from(sectorProjectedValues.values()).reduce((sum, value) => sum + value, 0);

    const rows = baseRows
      .map((baseRow) => {
        const projectedValueArs = sectorProjectedValues.get(baseRow.macroSector) ?? baseRow.realValueArs;
        const projectedPercent = totalProjectedArs > 0 ? (projectedValueArs / totalProjectedArs) * 100 : null;
        const projectedDifferencePercent = this.differencePercent(baseRow.targetPercent, projectedPercent);
        const changePercentPoints = baseRow.realPercent !== null && projectedPercent !== null ? projectedPercent - baseRow.realPercent : null;

        return {
          macroSector: baseRow.macroSector,
          targetPercent: baseRow.targetPercent,
          realValueArs: baseRow.realValueArs,
          projectedValueArs,
          realPercent: baseRow.realPercent,
          projectedPercent,
          realDifferencePercent: baseRow.realDifferencePercent,
          projectedDifferencePercent,
          changePercentPoints,
          realStatus: baseRow.realStatus,
          projectedStatus: this.statusFor(projectedDifferencePercent)
        };
      })
      .sort((left, right) => Math.abs(right.projectedDifferencePercent ?? 0) - Math.abs(left.projectedDifferencePercent ?? 0));

    const improvingRows = rows
      .filter((row) => this.isImproving(row))
      .sort((left, right) => this.improvementScore(right) - this.improvementScore(left))
      .slice(0, 3);
    const worseningRows = rows
      .filter((row) => this.isWorsening(row))
      .sort((left, right) => this.worseningScore(right) - this.worseningScore(left))
      .slice(0, 3);
    const inRangeRows = rows.filter((row) => row.projectedStatus === 'En rango').slice(0, 3);

    return {
      assets,
      rows,
      totalRealArs,
      totalProjectedArs,
      operationsCount: this.operations.length,
      improvingRows,
      worseningRows,
      inRangeRows,
      symbolProjectedValues,
      warnings
    };
  }

  addOperation(snapshot: PortfolioAppState): void {
    this.errorMessage = null;
    const assets = this.availableAssets(snapshot);
    const symbol = this.normalizeSymbol(this.form.symbol);
    const amountArs = Number(this.form.amountArs);

    if (!assets.length) {
      this.errorMessage = 'No hay especies estratégicas disponibles para simular.';
      return;
    }

    if (!symbol) {
      this.errorMessage = 'Elegí una especie existente.';
      return;
    }

    const asset = assets.find((item) => this.normalizeSymbol(item.symbol) === symbol) ?? null;
    if (!asset) {
      this.errorMessage = 'Elegí una especie existente.';
      return;
    }

    if (!Number.isFinite(amountArs) || amountArs <= 0) {
      this.errorMessage = 'Ingresá un monto mayor a 0.';
      return;
    }

    if (this.form.type === 'sell') {
      const currentValue = this.projection(snapshot).symbolProjectedValues.get(symbol) ?? 0;
      if (amountArs > currentValue + 0.0001) {
        this.errorMessage = `No podés vender más que el valor disponible proyectado de ${symbol}.`;
        return;
      }
    }

    this.operations = [
      ...this.operations,
      {
        id: this.newId(),
        type: this.form.type,
        symbol,
        macroSector: this.normalizeSector(asset.macroSector),
        amountArs
      }
    ];
    this.persistOperations();
    this.form.amountArs = null;
  }

  removeOperation(operationId: string): void {
    this.operations = this.operations.filter((operation) => operation.id !== operationId);
    this.persistOperations();
  }

  clearSimulation(): void {
    this.operations = [];
    this.errorMessage = null;
    this.persistOperations();
  }

  availableAssets(snapshot: PortfolioAppState): StrategicAllocationAsset[] {
    const items = [...(snapshot.dataset?.strategicAllocationAssets ?? [])]
      .filter((item) => {
        const sector = this.normalizeSector(item.macroSector);
        return this.normalizeSymbol(item.symbol) && sector && sector.toLowerCase() !== 'total';
      });
    const bySymbol = new Map<string, StrategicAllocationAsset>();
    for (const item of items) {
      const symbol = this.normalizeSymbol(item.symbol);
      if (!bySymbol.has(symbol)) {
        bySymbol.set(symbol, item);
      }
    }
    return [...bySymbol.values()].sort((left, right) => this.normalizeSymbol(left.symbol).localeCompare(this.normalizeSymbol(right.symbol)));
  }

  availableObjectives(snapshot: PortfolioAppState): StrategicSectorObjective[] {
    return [...(snapshot.dataset?.strategicSectorObjectives ?? [])]
      .filter((item) => {
        const sector = this.normalizeSector(item.macroSector);
        return sector && sector.toLowerCase() !== 'total';
      })
      .sort((left, right) => Math.abs((right.differencePercent ?? 0)) - Math.abs((left.differencePercent ?? 0)));
  }

  formatMoney(value: number | null | undefined): string {
    return this.currencyMapper.formatCurrency(value, 'ARS');
  }

  formatPercent(value: number | null | undefined): string {
    return this.currencyMapper.formatPercentage(value);
  }

  formatPercentSigned(value: number | null | undefined): string {
    if (value === null || value === undefined || Number.isNaN(value)) {
      return 'N/D';
    }
    return `${value > 0 ? '+' : ''}${this.currencyMapper.formatPercentage(value)}`;
  }

  statusClass(status: StrategicAllocationStatus): string {
    switch (status) {
      case 'Falta peso':
        return 'status-pill--positive';
      case 'Sobrepeso':
        return 'status-pill--negative';
      case 'En rango':
        return 'status-pill--muted';
      default:
        return 'status-pill--muted';
    }
  }

  trackByOperation(_: number, operation: StrategicSimulationOperation): string {
    return operation.id;
  }

  trackByRow(_: number, row: StrategicProjectionRow): string {
    return row.macroSector;
  }

  trackByAsset(_: number, asset: StrategicAllocationAsset): string {
    return this.normalizeSymbol(asset.symbol);
  }

  private loadOperations(): StrategicSimulationOperation[] {
    try {
      const raw = localStorage.getItem(this.storageKey);
      if (!raw) {
        return [];
      }
      const parsed = JSON.parse(raw) as StrategicSimulationOperation[];
      if (!Array.isArray(parsed)) {
        return [];
      }
      return parsed
        .map((item) => ({
          id: String(item.id ?? ''),
          type: (item.type === 'sell' ? 'sell' : 'buy') as SimulationOperationType,
          symbol: this.normalizeSymbol(item.symbol),
          macroSector: this.normalizeSector(item.macroSector),
          amountArs: this.safeNumber(item.amountArs)
        }))
        .filter((item) => item.id && item.symbol && item.macroSector && item.amountArs > 0);
    } catch {
      return [];
    }
  }

  private persistOperations(): void {
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(this.operations));
    } catch {
      // No-op: localStorage puede no estar disponible en algunos entornos.
    }
  }

  private ensureDefaultSymbol(): void {
    const snapshot = this.state.snapshot;
    const assets = this.availableAssets(snapshot);
    if (!assets.length) {
      return;
    }
    const normalized = this.normalizeSymbol(this.form.symbol);
    if (!normalized || !assets.some((asset) => this.normalizeSymbol(asset.symbol) === normalized)) {
      this.form.symbol = assets[0].symbol;
    }
  }

  private totalBaseValue(
    sectors: Set<string>,
    objectiveBySector: Map<string, StrategicSectorObjective>,
    assetValueBySector: Map<string, number>
  ): number {
    let total = 0;
    for (const sector of sectors) {
      const objective = objectiveBySector.get(sector);
      total += objective?.currentValueArs ?? assetValueBySector.get(sector) ?? 0;
    }
    return total;
  }

  private differencePercent(targetPercent: number | null, actualPercent: number | null): number | null {
    if (targetPercent === null || actualPercent === null || Number.isNaN(targetPercent) || Number.isNaN(actualPercent)) {
      return null;
    }
    return targetPercent - actualPercent;
  }

  private statusFor(differencePercent: number | null): StrategicAllocationStatus {
    if (differencePercent === null || Number.isNaN(differencePercent)) {
      return 'Sin datos';
    }
    if (differencePercent > 0.5) {
      return 'Falta peso';
    }
    if (differencePercent < -0.5) {
      return 'Sobrepeso';
    }
    return 'En rango';
  }

  private isImproving(row: StrategicProjectionRow): boolean {
    return row.realDifferencePercent !== null && row.projectedDifferencePercent !== null && Math.abs(row.projectedDifferencePercent) < Math.abs(row.realDifferencePercent);
  }

  private isWorsening(row: StrategicProjectionRow): boolean {
    return row.realDifferencePercent !== null && row.projectedDifferencePercent !== null && Math.abs(row.projectedDifferencePercent) > Math.abs(row.realDifferencePercent);
  }

  private improvementScore(row: StrategicProjectionRow): number {
    return Math.abs(row.realDifferencePercent ?? 0) - Math.abs(row.projectedDifferencePercent ?? 0);
  }

  private worseningScore(row: StrategicProjectionRow): number {
    return Math.abs(row.projectedDifferencePercent ?? 0) - Math.abs(row.realDifferencePercent ?? 0);
  }

  private normalizeSymbol(value: unknown): string {
    return String(value ?? '').trim().toUpperCase();
  }

  private normalizeSector(value: unknown): string {
    return String(value ?? '').trim();
  }

  private safeNumber(value: number | string | null | undefined): number {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : 0;
  }

  private newId(): string {
    if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
      return crypto.randomUUID();
    }
    return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }
}
