import { BadRequestException, Injectable } from '@nestjs/common';
import * as argon2 from 'argon2';
import { randomInt } from 'node:crypto';

const COMMON_PASSWORDS = new Set([
  'password123!',
  'password1234!',
  'qwerty123456!',
  'admin123456!',
  'welcome12345!',
]);

@Injectable()
export class PasswordService {
  validate(password: string, identity?: { name?: string; email?: string }) {
    if (password.length < 12 || password.length > 128) {
      throw new BadRequestException(
        'Password must be between 12 and 128 characters.',
      );
    }
    if (password !== password.trim()) {
      throw new BadRequestException(
        'Password must not start or end with whitespace.',
      );
    }
    if (
      !/[A-Za-z]/.test(password) ||
      !/\d/.test(password) ||
      !/[^A-Za-z0-9\s]/.test(password)
    ) {
      throw new BadRequestException(
        'Password must include a letter, a number, and a special character.',
      );
    }

    const normalized = password.toLowerCase();
    if (COMMON_PASSWORDS.has(normalized)) {
      throw new BadRequestException('Choose a less common password.');
    }
    const email = identity?.email?.trim().toLowerCase();
    const name = identity?.name?.trim().toLowerCase();
    if (
      (email && normalized === email) ||
      (name && normalized === name) ||
      (email && normalized === email.split('@')[0])
    ) {
      throw new BadRequestException(
        'Password must not match the employee name or email.',
      );
    }
  }

  hash(password: string): Promise<string> {
    return argon2.hash(password);
  }

  verify(hash: string, password: string): Promise<boolean> {
    return argon2.verify(hash, password);
  }

  generateTemporaryPassword() {
    const letters = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
    const numbers = '23456789';
    const specials = '!@#$%^&*_-+=';
    const all = `${letters}${numbers}${specials}`;
    const chars = [
      letters[randomInt(letters.length)],
      numbers[randomInt(numbers.length)],
      specials[randomInt(specials.length)],
    ];
    while (chars.length < 16) {
      chars.push(all[randomInt(all.length)]);
    }
    for (let index = chars.length - 1; index > 0; index -= 1) {
      const swap = randomInt(index + 1);
      [chars[index], chars[swap]] = [chars[swap], chars[index]];
    }
    return chars.join('');
  }
}
