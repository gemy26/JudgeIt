export type SolvedProblemResult = {
  id: number;
  title: string;
  difficulty: string;
  execution_time: number | null;
  memory_user: number | null;
  solved_at: Date;
};