import { SolvedProblemResult } from './solved-problem-result.type';

export interface UserProfile{
  username: string
  email: string
  solvedProblemsCount: number
  submissionsCount: number
  recentAcProblems: SolvedProblemResult []
}