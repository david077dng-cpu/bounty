export interface TaskStep {
  0: string; // type: step, think, calc, ok, warn, etc.
  1: string; // text
}

export interface TaskScores {
  accuracy: number;
  reasoning: number;
  creativity: number;
  speed: number;
}
