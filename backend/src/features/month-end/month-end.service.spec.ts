import { Test, TestingModule } from '@nestjs/testing';
import { MonthEndService } from './month-end.service';

describe('MonthEndService', () => {
  let service: MonthEndService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [MonthEndService],
    }).compile();

    service = module.get<MonthEndService>(MonthEndService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
