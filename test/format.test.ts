import { extractPhoneNumberFromVCard } from '../utils/format';

describe('extractPhoneNumberFromVCard', () => {
  it('returns the phone number when present', () => {
    const vcard = 'TEL;TYPE=CELL:+1234567890';
    expect(extractPhoneNumberFromVCard(vcard)).toBe('+1234567890');
  });

  it('handles VALUE=uri syntax', () => {
    const vcard = 'TEL;VALUE=uri:tel:+19876543210';
    expect(extractPhoneNumberFromVCard(vcard)).toBe('+19876543210');
  });

  it('returns undefined when no number exists', () => {
    const vcard = 'TEL;TYPE=CELL:';
    expect(extractPhoneNumberFromVCard(vcard)).toBeUndefined();
  });


  it('returns undefined for unrelated lines', () => {
    const vcard = 'EMAIL:test@example.com';
    expect(extractPhoneNumberFromVCard(vcard)).toBeUndefined();
  });

});
