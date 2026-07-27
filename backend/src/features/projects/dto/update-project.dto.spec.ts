import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { UpdateProjectDto } from './update-project.dto';

async function errors(value: object) {
  return validate(plainToInstance(UpdateProjectDto, value), {
    whitelist: true,
    forbidNonWhitelisted: true,
  });
}

describe('UpdateProjectDto', () => {
  it('accepts supported editable project fields', async () => {
    await expect(
      errors({
        title: 'Retainer Plan',
        growthObjective: 'Increase qualified leads',
        platforms: ['instagram', 'linkedin'],
        startDate: '2026-08-01',
        endDate: '2026-08-31',
        month: 8,
        year: 2026,
        assignedUserId: '22222222-2222-4222-8222-222222222222',
        contentTarget: 24,
      }),
    ).resolves.toHaveLength(0);
  });

  it('rejects unknown and immutable project fields', async () => {
    await expect(
      errors({ clientId: '11111111-1111-4111-8111-111111111111' }),
    ).resolves.toHaveLength(1);
    await expect(
      errors({ sopVersionId: '33333333-3333-4333-8333-333333333333' }),
    ).resolves.toHaveLength(1);
    await expect(
      errors({ spreadsheetWorksheet: { id: 'worksheet-1' } }),
    ).resolves.toHaveLength(1);
    await expect(errors({ status: 'ACTIVE' })).resolves.toHaveLength(1);
    await expect(errors({ unexpected: 'value' })).resolves.toHaveLength(1);
  });

  it('validates editable field formats', async () => {
    await expect(errors({ title: '' })).resolves.not.toHaveLength(0);
    await expect(errors({ month: 13 })).resolves.not.toHaveLength(0);
    await expect(errors({ year: 1999 })).resolves.not.toHaveLength(0);
    await expect(
      errors({ assignedUserId: 'not-a-uuid' }),
    ).resolves.not.toHaveLength(0);
    await expect(errors({ platforms: [1] })).resolves.not.toHaveLength(0);
  });
});
