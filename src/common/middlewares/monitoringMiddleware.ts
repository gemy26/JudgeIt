import { Injectable, NestMiddleware } from '@nestjs/common';
import { MetricService } from '../../monitoring/metricService';
@Injectable()
export class MonitoringMiddleware implements NestMiddleware {
  constructor(private readonly metricService: MetricService) {}
  use(req: any, res: any, next: (error?: any) => void) {
    const startTime = process.hrtime();
    const url = req.originalUrl.split('?')[0];
    this.metricService.httpRequestsInFlight.inc({
      method: req.method,
      route: url,
    });
    res.on('finish', () => {
      const [seconds, nanoseconds] = process.hrtime(startTime);
      const durationInSeconds = seconds + nanoseconds / 1e9;

      const labels = {
        method: req.method,
        route: url,
        status: String(res.statusCode),
      };

      this.metricService.httpRequestDuration.observe(labels, durationInSeconds);
      this.metricService.httpRequestsTotal.inc(labels);
      this.metricService.httpRequestsInFlight.dec({
        method: req.method,
        route: url,
      });
    });
    next();
  }
}
