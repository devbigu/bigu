import { Test, TestingModule } from '@nestjs/testing';
import { GrowthPlansService } from './growth-plans.service';

describe('GrowthPlansService', () => {
  let service: GrowthPlansService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [GrowthPlansService],
    }).compile();

    service = module.get<GrowthPlansService>(GrowthPlansService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
