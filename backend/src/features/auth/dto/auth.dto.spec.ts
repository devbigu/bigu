import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { LoginDto } from './login.dto';
import { RegisterDto } from './register.dto';

async function validateDto<T extends object>(dto: new () => T, value: object) {
  return validate(plainToInstance(dto, value));
}

describe('Auth DTO validation', () => {
  it('requires username and email for registration', async () => {
    const errors = await validateDto(RegisterDto, {
      name: 'Aditya',
      password: 'Password123',
    });

    expect(errors.map((error) => error.property)).toEqual(
      expect.arrayContaining(['username', 'email']),
    );
  });

  it('accepts valid registration username characters', async () => {
    const errors = await validateDto(RegisterDto, {
      name: 'Aditya',
      username: 'aditya.setia_1',
      email: 'adityaxsetia@gmail.com',
      password: 'Password123',
    });

    expect(errors).toHaveLength(0);
  });

  it('rejects invalid usernames', async () => {
    const errors = await validateDto(RegisterDto, {
      name: 'Aditya',
      username: 'aditya-setia',
      email: 'adityaxsetia@gmail.com',
      password: 'Password123',
    });

    expect(errors.find((error) => error.property === 'username')).toBeDefined();
  });

  it('requires login identifier instead of email', async () => {
    const errors = await validateDto(LoginDto, {
      email: 'adityaxsetia@gmail.com',
      password: 'Password123',
    });

    expect(errors.map((error) => error.property)).toContain('identifier');
  });

  it('accepts username or email as a login identifier string', async () => {
    await expect(
      validateDto(LoginDto, {
        identifier: 'aditya',
        password: 'Password123',
      }),
    ).resolves.toHaveLength(0);

    await expect(
      validateDto(LoginDto, {
        identifier: 'adityaxsetia@gmail.com',
        password: 'Password123',
      }),
    ).resolves.toHaveLength(0);
  });
});
