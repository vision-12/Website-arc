import { describe, expect, it } from 'vitest';
import { formatDateTimeLong, formatDateTimeShort, utcToZoned, zonedTimeToUtc } from '../zoned';

describe('zonedTimeToUtc', () => {
  it('converts Kampala wall-clock time to UTC (EAT is UTC+3 all year)', () => {
    expect(zonedTimeToUtc('2026-11-26', '09:30', 'Africa/Kampala')?.toISOString()).toBe(
      '2026-11-26T06:30:00.000Z',
    );
    expect(zonedTimeToUtc('2027-01-01', '00:15', 'Africa/Kampala')?.toISOString()).toBe(
      '2026-12-31T21:15:00.000Z',
    );
  });

  it('handles daylight-saving zones on both sides of a change', () => {
    expect(zonedTimeToUtc('2026-07-01', '12:00', 'Europe/London')?.toISOString()).toBe(
      '2026-07-01T11:00:00.000Z',
    );
    expect(zonedTimeToUtc('2026-12-01', '12:00', 'Europe/London')?.toISOString()).toBe(
      '2026-12-01T12:00:00.000Z',
    );
  });

  it('rejects malformed input and times that do not exist', () => {
    expect(zonedTimeToUtc('2026-02-30', '09:00', 'Africa/Kampala')).toBeNull();
    expect(zonedTimeToUtc('2026-11-26', '25:00', 'Africa/Kampala')).toBeNull();
    expect(zonedTimeToUtc('26/11/2026', '09:00', 'Africa/Kampala')).toBeNull();
    // 01:30 on the day the UK clocks go forward never happens.
    expect(zonedTimeToUtc('2026-03-29', '01:30', 'Europe/London')).toBeNull();
  });
});

describe('utcToZoned', () => {
  it('round-trips with zonedTimeToUtc', () => {
    const utc = zonedTimeToUtc('2026-11-26', '17:05', 'Africa/Kampala')!;
    expect(utcToZoned(utc, 'Africa/Kampala')).toEqual({ date: '2026-11-26', time: '17:05' });
  });
});

describe('formatting in the school zone', () => {
  it('writes long and short forms in UK English', () => {
    expect(formatDateTimeLong('2026-11-26T06:30:00Z', 'Africa/Kampala')).toBe(
      'Thursday 26 November 2026 at 9:30am',
    );
    expect(formatDateTimeShort('2026-11-26T14:00:00Z', 'Africa/Kampala')).toBe(
      '26 Nov 2026, 5:00pm',
    );
  });
});
