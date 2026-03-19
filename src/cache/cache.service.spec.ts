import { Test, TestingModule } from '@nestjs/testing';
import { CacheService } from './cache.service';
import { CACHE_MANAGER } from '@nestjs/cache-manager';

const mockCacheManager = {
  get: jest.fn(),
  set: jest.fn(),
  del: jest.fn(),
};

describe('CacheService', () => {
  let service: CacheService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CacheService,
        {
          provide: CACHE_MANAGER,
          useValue: mockCacheManager,
        },
      ],
    }).compile();

    service = module.get<CacheService>(CacheService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('get', () => {
    it('should return value when key exists', async () => {
      mockCacheManager.get.mockResolvedValue({ id: 1 });
      const data = await service.get<{ id: number }>(String(1));
      expect(data).toEqual({ id: 1 });
    });

    it('should return null when key not exist', async () => {
      mockCacheManager.get.mockResolvedValue(undefined);
      const data = await service.get<{ id: number }>(String(1));
      expect(data).toBeNull();
    });
  });

  describe('set', () => {
    it('should set value with ttl', async () => {
      await service.set('user:1', { id: 1 }, 600);
      expect(mockCacheManager.set).toHaveBeenCalledWith(
        'user:1',
        { id: 1 },
        600,
      );
    });
  });

  describe('getOrset', () => {
    it('should return cached value and not call fetchFn on hit', async () => {
      const fetchFn = jest.fn();
      mockCacheManager.get.mockResolvedValue({ id: 1 });
      const data = await service.getOrSet(String(1), fetchFn);
      expect(data).toEqual({ id: 1 });
    });

    it('should return new value and cache it on miss', async () => {
      const fetchFn = jest.fn().mockResolvedValue({ id: 2 });
      mockCacheManager.get.mockResolvedValue(undefined);
      mockCacheManager.set.mockResolvedValue(undefined);
      const data = await service.getOrSet(String(1), fetchFn);
      expect(data).toEqual({ id: 2 });
      expect(fetchFn).toHaveBeenCalledTimes(1);
    });

    it('should not cache when fetchFn returns null', async () => {
      mockCacheManager.get.mockResolvedValue(undefined);
      const fetchFn = jest.fn().mockResolvedValue(null);
      const data = await service.getOrSet('user:1', fetchFn);
      expect(data).toBeNull();
      expect(mockCacheManager.set).not.toHaveBeenCalled();
    });
  });
});
