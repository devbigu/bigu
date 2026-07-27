import { validateSync } from 'class-validator';
import { UpdateAppearanceDto } from './update-appearance.dto';

describe('UpdateAppearanceDto', () => {
  it.each(['#6366F1', '#2563eb'])(
    'accepts strict six-digit hex %s',
    (value) => {
      const dto = Object.assign(new UpdateAppearanceDto(), {
        accentColor: value,
      });
      expect(validateSync(dto)).toHaveLength(0);
    },
  );

  it.each([
    '#abc',
    '6366F1',
    'url(https://example.com)',
    'var(--primary)',
    'linear-gradient(red, blue)',
  ])('rejects invalid or unsafe color %s', (value) => {
    const dto = Object.assign(new UpdateAppearanceDto(), {
      accentColor: value,
    });
    expect(validateSync(dto).length).toBeGreaterThan(0);
  });
  it('accepts a theme color or null to restore the default theme', () => {
    expect(
      validateSync(
        Object.assign(new UpdateAppearanceDto(), { themeColor: '#0D9488' }),
      ),
    ).toHaveLength(0);
    expect(
      validateSync(
        Object.assign(new UpdateAppearanceDto(), { themeColor: null }),
      ),
    ).toHaveLength(0);
  });
});
