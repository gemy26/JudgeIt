import { Module } from '@nestjs/common';
import { MetricService } from './metricService';
import { PrometheusModule } from '@willsoto/nestjs-prometheus';
import { register as defaultRegister } from 'prom-client';
@Module({
  imports: [
    PrometheusModule.register({
      path: '/metrics',
      defaultMetrics: {
        enabled: true,
      },
    }),
  ],
  providers: [
    {
      provide: 'PROMETHEUS_REGISTRY',
      useValue: defaultRegister,
    },
    MetricService,
  ],
  exports: [MetricService],
})
export class MonitoringModule {}
