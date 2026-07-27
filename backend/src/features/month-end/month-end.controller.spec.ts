import { Test, TestingModule } from '@nestjs/testing';
import { MonthEndController } from './month-end.controller';

describe('MonthEndController', () => {
  let controller: MonthEndController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [MonthEndController],
    }).compile();

    controller = module.get<MonthEndController>(MonthEndController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
