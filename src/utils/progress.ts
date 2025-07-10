import { EventEmitter } from 'events';

export interface ProgressUpdate {
  stage: string;
  progress: number;
  message: string;
  timestamp: Date;
}

export class ProgressTracker extends EventEmitter {
  private currentStage: string = '';
  private totalStages: number = 0;
  private completedStages: number = 0;
  private stageProgress: number = 0;

  constructor(stages: string[]) {
    super();
    this.totalStages = stages.length;
  }

  startStage(stageName: string): void {
    this.currentStage = stageName;
    this.stageProgress = 0;
    this.emitProgress(`Starting ${stageName}...`);
  }

  updateStage(progress: number, message?: string): void {
    this.stageProgress = Math.max(0, Math.min(100, progress));
    this.emitProgress(message || `${this.currentStage} ${progress}%`);
  }

  completeStage(): void {
    this.completedStages++;
    this.stageProgress = 100;
    this.emitProgress(`Completed ${this.currentStage}`);
  }

  private emitProgress(message: string): void {
    const overallProgress = this.totalStages > 0 
      ? ((this.completedStages + this.stageProgress / 100) / this.totalStages) * 100
      : 0;

    const update: ProgressUpdate = {
      stage: this.currentStage,
      progress: overallProgress,
      message,
      timestamp: new Date(),
    };

    this.emit('progress', update);
  }

  getOverallProgress(): number {
    return this.totalStages > 0 
      ? ((this.completedStages + this.stageProgress / 100) / this.totalStages) * 100
      : 0;
  }
}