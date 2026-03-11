import { OffsetTrackerService } from './offset-Tracker.service';

describe('OffsetTrackerService', () => {
  let service: OffsetTrackerService;

  beforeEach(() => {
    service = new OffsetTrackerService();
  });

  it('should advance committed offset once the lowest in-flight offset completes', () => {
    service.track(1, '0');
    service.track(1, '1');
    service.track(1, '2');
    service.track(1, '3');

    const commit1 = service.complete(1, '1');
    expect(commit1).toBe(null);
    const commit2 = service.complete(1, '2');
    expect(commit2).toBe(null);
    const commit3 = service.complete(1, '0');
    expect(commit3).toBe('2');
  });
});
