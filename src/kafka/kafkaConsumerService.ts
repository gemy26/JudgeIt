import { Controller, Injectable } from '@nestjs/common';
import { KafkaService } from './kafka.service';
import { EventPattern, Payload } from '@nestjs/microservices';
import { ExecutionService } from '../execution/execution.service';
import type {SubmissionQueuedEvent} from '../types';
import { JudgeWorkerService } from 'src/judge/judge-worker/judge-worker.service';
import { SubmissionsService } from '../submissions/submissions.service';

@Controller()
export class KafkaConsumerService {
  constructor(
    private judgeService: JudgeWorkerService,
  ) {}

  @EventPattern("ExecuteSubmission")
  async handleEvent(@Payload() message: SubmissionQueuedEvent) {
    console.log("Message Consumed");
    console.log(`Received ${JSON.stringify(message)}`);
    const verdicates = await this.judgeService.judgeSubmission(message);
    console.log("Final verdicates: ", verdicates);
  }
}
