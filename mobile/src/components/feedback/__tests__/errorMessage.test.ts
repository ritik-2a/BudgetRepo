import { errorMessage } from '../States';

describe('errorMessage', () => {
  it('extracts readable text from anything thrown', () => {
    expect(errorMessage(new Error('Amount must be greater than ₹0'))).toBe(
      'Amount must be greater than ₹0',
    );
    expect(errorMessage('disk full')).toBe('disk full');
    expect(errorMessage({ code: 'SQLITE_BUSY' })).toBe('{"code":"SQLITE_BUSY"}');
    expect(errorMessage(null)).toBeNull();
    expect(errorMessage(undefined)).toBeNull();
  });
});
