export interface SubmissionResult {
  submissionId: number;
  testcaseName: string;
  executionTime: number;
  memoryUsed: number;
  verdict: string;
  createdAt: Date
}