export interface SubmissionResponse {
  id: number;
  user_id: number;
  problem_id: number;
  verdicate: string;
  language: string;
  source_code: string;
  execution_time?: number | null;
  memory_user?: number | null;
  created_at: Date;

  user: {
    username: string;
  };

  problem: {
    title: string;
  };
}
