export interface ExecutionConfig {
  timeLimit: number;
  memoryLimit: number;
  stackLimit?: number;
  processes?: number;
  wallTimeMultiplier?: number;
}

export interface ExecutionResult {
  success: boolean;
  output?: string;
  error?: string;
  time?: number;
  memory?: number;
  exitCode?: number;
  status: 'OK' | 'TLE' | 'MLE' | 'RE' | 'CE' | 'SE';
}