import { extractPhoneNumberFromVCard } from '../utils/format';

describe('extractPhoneNumberFromVCard', () => {
  it('returns the phone number when present', () => {
    const vcard = 'TEL;TYPE=CELL:+1234567890';
    expect(extractPhoneNumberFromVCard(vcard)).toBe('+1234567890');
  });

  it('returns undefined when no number exists', () => {
    const vcard = 'TEL;TYPE=CELL:';
    expect(extractPhoneNumberFromVCard(vcard)).toBeUndefined();
  });
});
