export interface ExecutionConfig {
  timeLimit: number;
  memoryLimit: number;
  stackLimit?: number;
  processes?: number;
}

export interface IsolateMeta {
  status: string;
  time: number;
  wallTime: number;
  memory: number;
  exitCode: number;
  signal: number;
  message: string;
}

export interface ExecutionResult {
  testCaseName?: string;
  success: boolean;
  output?: string;
  error?: string;
  stderr?: string;
  time?: number;
  wallTime?: number;
  memory?: number;
  exitCode?: number;
  signal?: number;
  status: 'OK' | 'TLE' | 'MLE' | 'RE' | 'CE' | 'SE';
}