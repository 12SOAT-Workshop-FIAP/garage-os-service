import { Test, TestingModule } from '@nestjs/testing';
import { MessagingService } from './messaging.service';

describe('MessagingService', () => {
  let service: MessagingService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [MessagingService],
    }).compile();

    service = module.get<MessagingService>(MessagingService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('publish', () => {
    it('should publish message to exchange', async () => {
      expect(service).toBeDefined();
    });
  });

  describe('subscribe', () => {
    it('should subscribe to queue', async () => {
      expect(service).toBeDefined();
    });
  });
});
