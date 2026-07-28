import { Test, TestingModule } from '@nestjs/testing';
import { GrowthPlansController } from './growth-plans.controller';
import { GrowthPlansService } from './growth-plans.service';

describe('GrowthPlansController', () => {
  let controller: GrowthPlansController;
  const service = { list: jest.fn(), detail: jest.fn() };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [GrowthPlansController],
      providers: [{ provide: GrowthPlansService, useValue: service }],
    }).compile();
    controller = module.get<GrowthPlansController>(GrowthPlansController);
  });

  it('delegates list and detail calls', () => {
    controller.list({ search: 'launch' });
    controller.detail('project-1');
    expect(service.list).toHaveBeenCalledWith({ search: 'launch' });
    expect(service.detail).toHaveBeenCalledWith('project-1');
  });
});
