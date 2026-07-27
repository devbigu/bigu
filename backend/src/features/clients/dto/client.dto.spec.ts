import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateClientDto } from './create-client.dto';
import { UpdateClientDto } from './update-client.dto';

async function errors(
  type: typeof CreateClientDto | typeof UpdateClientDto,
  value: object,
) {
  return validate(plainToInstance(type, value), {
    whitelist: true,
    forbidNonWhitelisted: true,
  });
}

describe('client DTO validation', () => {
  it('requires a name and rejects invalid URLs', async () => {
    expect(await errors(CreateClientDto, {})).not.toHaveLength(0);
    expect(
      await errors(CreateClientDto, {
        name: 'Acme',
        websiteUrl: 'example.com',
      }),
    ).not.toHaveLength(0);
  });
  it('trims values and converts optional blanks to undefined', () => {
    const dto = plainToInstance(CreateClientDto, {
      name: ' Acme ',
      industry: ' ',
    });
    expect(dto).toEqual(
      expect.objectContaining({ name: 'Acme', industry: undefined }),
    );
  });
  it('rejects protected and unknown properties on create and update', async () => {
    expect(
      await errors(CreateClientDto, { name: 'Acme', createdById: 'other' }),
    ).not.toHaveLength(0);
    expect(
      await errors(UpdateClientDto, { status: 'ARCHIVED' }),
    ).not.toHaveLength(0);
  });
});
