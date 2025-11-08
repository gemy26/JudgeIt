export interface SubmissionQueuedEvent {
  submissionId: number;
  userId: string;
  problemId: number;
  language: 'cpp' | 'python' ;
  code: string;
  timestamp: Date;

}