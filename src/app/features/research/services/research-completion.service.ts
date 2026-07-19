import { Injectable } from '@angular/core';
import { ResearchAssetItem } from '../models/research.models';

export type ResearchCompletionStatus = 'completo' | 'parcial' | 'incompleto';

export interface ResearchCompletionSummary {
  completedFields: number;
  totalFields: number;
  completionPercent: number;
  status: ResearchCompletionStatus;
  missingFields: string[];
}

@Injectable({ providedIn: 'root' })
export class ResearchCompletionService {
  summarize(item: ResearchAssetItem): ResearchCompletionSummary {
    const totalFields = item.fields.length;
    const completedFields = item.fields.filter((field) => this.hasValue(field.value)).length;
    const completionPercent = totalFields > 0 ? (completedFields / totalFields) * 100 : 0;

    return {
      completedFields,
      totalFields,
      completionPercent,
      status: this.status(completedFields, totalFields),
      missingFields: item.fields.filter((field) => !this.hasValue(field.value)).map((field) => field.label)
    };
  }

  summarizeMany(items: ResearchAssetItem[]): ResearchCompletionSummary {
    const totalFields = items.reduce((sum, item) => sum + item.fields.length, 0);
    const completedFields = items.reduce((sum, item) => sum + item.fields.filter((field) => this.hasValue(field.value)).length, 0);
    const completionPercent = totalFields > 0 ? (completedFields / totalFields) * 100 : 0;

    return {
      completedFields,
      totalFields,
      completionPercent,
      status: this.status(completedFields, totalFields),
      missingFields: []
    };
  }

  statusLabel(status: ResearchCompletionStatus): string {
    return status;
  }

  private status(completedFields: number, totalFields: number): ResearchCompletionStatus {
    if (totalFields <= 0 || completedFields <= 0) {
      return 'incompleto';
    }
    if (completedFields >= totalFields) {
      return 'completo';
    }
    return 'parcial';
  }

  private hasValue(value: string | null | undefined): boolean {
    return String(value ?? '').trim().length > 0;
  }
}

