import { Controller, Injectable } from '@nestjs/common';
import { KafkaService } from './kafka.service';
import { EventPattern, Payload } from '@nestjs/microservices';
import { ExecutionService } from '../execution/execution.service';
import { ExecutionConfig } from '../types';

@Controller()
export class KafkaConsumerService {
  constructor(
    private kafkaService: KafkaService,
    private executionService: ExecutionService
  ) {}

  @EventPattern("test-topic")
  async handleEvent(@Payload() message: any) {
    console.log("Message Consumed");
    console.log(`Received ${JSON.stringify(message)}`);

    // Don't override the config - use defaults
    // OR specify correct values (time is in SECONDS)
    const config: Partial<ExecutionConfig> = {
      timeLimit: 2,        // 2 seconds
      memoryLimit: 256000, // 256 MB in KB
      stackLimit: 256000,
      processes: 1,
      wallTimeMultiplier: 2
    };

    console.log("I'm sending the code to be executed.");
    const result = await this.executionService.executeCode(
      message.msg.code,
      'cpp',
      '5',
      config
    );

    console.log("Code Execution Result: \n", result);
  }
}
