import { Injectable } from '@angular/core';
import { PortfolioPosition } from '../models/portfolio.models';
import { PortfolioObjective } from '../models/analysis.models';

export interface PortfolioObjectiveStatus {
  objective: PortfolioObjective;
  currentPercent: number;
  targetPercent: number;
  gapPercent: number;
  currentValue: number;
  targetValue: number;
}

@Injectable({ providedIn: 'root' })
export class PortfolioObjectiveService {
  compare(objectives: PortfolioObjective[], positions: PortfolioPosition[]): PortfolioObjectiveStatus[] {
    const total = positions.reduce((sum, position) => sum + position.currentValue, 0);
    return objectives.map((objective) => {
      const currentValue = this.currentValueForObjective(objective, positions);
      const currentPercent = total > 0 ? (currentValue / total) * 100 : 0;
      return {
        objective,
        currentPercent,
        targetPercent: objective.targetPercent,
        gapPercent: currentPercent - objective.targetPercent,
        currentValue,
        targetValue: total * (objective.targetPercent / 100)
      };
    });
  }

  defaultObjectives(): PortfolioObjective[] {
    return [];
  }

  private currentValueForObjective(objective: PortfolioObjective, positions: PortfolioPosition[]): number {
    const scope = String(objective.groupType ?? '').toLowerCase();
    const name = String(objective.groupName ?? '').toLowerCase();
    return positions
      .filter((position) => {
        if (scope === 'tipo_activo') return String(position.assetType ?? '').toLowerCase() === name;
        if (scope === 'sector') return String(position.sector ?? '').toLowerCase() === name;
        if (scope === 'subsector') return String(position.subsector ?? '').toLowerCase() === name;
        if (scope === 'region') return String(position.region ?? '').toLowerCase() === name;
        if (scope === 'tramo') return name.includes('retiro') ? true : name.includes('ahorro') ? true : false;
        return false;
      })
      .reduce((sum, position) => sum + position.currentValue, 0);
  }
}
