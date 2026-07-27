import { Test, TestingModule } from '@nestjs/testing';
import { GrowthPlansController } from './growth-plans.controller';

describe('GrowthPlansController', () => {
  let controller: GrowthPlansController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [GrowthPlansController],
    }).compile();

    controller = module.get<GrowthPlansController>(GrowthPlansController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
