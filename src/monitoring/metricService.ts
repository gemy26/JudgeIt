import { Inject, Injectable } from '@nestjs/common';
import { Counter, Gauge, Histogram, Registry } from 'prom-client';

@Injectable()
export class MetricService {
  // HTTP
  readonly httpRequestsTotal: Counter<string>;
  readonly httpRequestDuration: Histogram<string>;
  readonly httpRequestsInFlight: Gauge<string>;

  // MESSAGE QUEUE
  readonly messageQueueConsumerProducedTotal: Counter<string>;
  readonly messageQueueConsumerConsumedTotal: Counter<string>;
  readonly messageQueueLatency: Histogram<string>;
  readonly messageQueueConsumerErrorsTotal: Counter<string>;

  // S3 / STORAGE
  readonly storageServiceLatency: Histogram<string>;

  // CACHE
  readonly cacheHits: Counter<string>;
  readonly cacheMiss: Counter<string>;
  readonly cacheHitDuration: Histogram<string>;

  // DB
  readonly dbQueryDuration: Histogram<string>;

  constructor(
    @Inject('PROMETHEUS_REGISTRY') private readonly registry: Registry,
  ) {
    this.httpRequestsTotal = new Counter({
      name: 'http_requests_total',
      help: 'Total number of HTTP requests',
      labelNames: ['method', 'route', 'status'],
      registers: [this.registry],
    });

    this.httpRequestDuration = new Histogram({
      name: 'http_request_duration_seconds',
      help: 'HTTP request duration in seconds',
      labelNames: ['method', 'route', 'status'],
      buckets: [0.005, 0.01, 0.05, 0.1, 0.3, 0.5, 1, 2, 5],
      registers: [this.registry],
    });

    this.httpRequestsInFlight = new Gauge({
      name: 'http_requests_in_flight',
      help: 'Number of HTTP requests currently being processed',
      labelNames: ['method', 'route'],
      registers: [this.registry],
    });

    this.messageQueueConsumerProducedTotal = new Counter({
      name: 'mq_messages_produced_total',
      help: 'Total number of messages produced to the queue',
      labelNames: ['topic'],
      registers: [this.registry],
    });

    this.messageQueueConsumerConsumedTotal = new Counter({
      name: 'mq_messages_consumed_total',
      help: 'Total number of messages consumed from the queue',
      labelNames: ['topic'],
      registers: [this.registry],
    });

    this.messageQueueLatency = new Histogram({
      name: 'mq_message_latency_seconds',
      help: 'Time taken to process a message',
      labelNames: ['topic'],
      buckets: [0.001, 0.01, 0.05, 0.1, 0.5, 1, 2, 5],
      registers: [this.registry],
    });

    this.messageQueueConsumerErrorsTotal = new Counter({
      name: 'mq_consumer_errors_total',
      help: 'Total number of message consumer errors',
      labelNames: ['topic', 'error_type'],
      registers: [this.registry],
    });

    this.storageServiceLatency = new Histogram({
      name: 'storage_request_duration_seconds',
      help: 'Latency of storage service operations (e.g., S3)',
      labelNames: ['operation', 'status'],
      buckets: [0.01, 0.05, 0.1, 0.3, 1, 2, 5],
      registers: [this.registry],
    });

    this.cacheHits = new Counter({
      name: 'cache_hits_total',
      help: 'Total number of cache hits',
      labelNames: ['cache_key'],
      registers: [this.registry],
    });

    this.cacheMiss = new Counter({
      name: 'cache_miss_total',
      help: 'Total number of cache misses',
      labelNames: ['cache_key'],
      registers: [this.registry],
    });

    this.cacheHitDuration = new Histogram({
      name: 'cache_hit_duration_seconds',
      help: 'Time taken to retrieve data from cache',
      labelNames: ['cache_key'],
      buckets: [0.0005, 0.001, 0.005, 0.01, 0.05],
      registers: [this.registry],
    });

    this.dbQueryDuration = new Histogram({
      name: 'db_query_duration_seconds',
      help: 'Database query execution time',
      labelNames: ['query', 'operation'],
      buckets: [0.001, 0.01, 0.05, 0.1, 0.5, 1, 2],
      registers: [this.registry],
    });
  }
}
