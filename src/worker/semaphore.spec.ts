import { SemaphoreService } from './semaphore.service';

describe('SemaphoreService', () => {
  let service: SemaphoreService;

  beforeEach(() => {
    service = new SemaphoreService(2);
  });

  it('should queue the request when no slots are available', async () => {
    await service.acquire();
    await service.acquire();

    let resolved = false;
    const blocked = service.acquire();
    blocked.then(() => {
      resolved = true;
    });

    expect(service.available).toBe(0);
    expect(service.pending).toBe(1);

    service.release();
    await blocked;

    expect(resolved).toBe(true);
    expect(service.pending).toBe(0);
  });
});
