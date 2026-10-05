import { test, expect } from '@playwright/test';
import { filterTimelineForSession } from '../src/dayClosingTimeline.js';

test('Day Closing timeline keeps only events inside the exact attendance session', async () => {
  const session = {
    start_day_at: '2026-10-05T04:30:00.000Z',
    end_day_at: '2026-10-05T12:30:00.000Z',
  };
  const events = [
    { at: '2026-10-05T04:29:59.000Z', text: 'before' },
    { at: '2026-10-05T04:30:00.000Z', text: 'start' },
    { at: '2026-10-05T08:15:00.000Z', text: 'inside' },
    { at: '2026-10-05T12:30:00.000Z', text: 'end' },
    { at: '2026-10-05T12:30:01.000Z', text: 'after' },
  ];

  expect(filterTimelineForSession(events, session).map((event) => event.text)).toEqual(['start', 'inside', 'end']);
});

test('open Day Closing session stops timeline at current time', async () => {
  const session = { start_day_at: '2026-10-05T04:30:00.000Z', end_day_at: null };
  const events = [
    { at: '2026-10-05T04:30:00.000Z', text: 'start' },
    { at: '2026-10-05T09:00:00.000Z', text: 'inside' },
    { at: '2026-10-05T10:00:01.000Z', text: 'future' },
  ];

  expect(filterTimelineForSession(events, session, Date.parse('2026-10-05T10:00:00.000Z')).map((event) => event.text)).toEqual(['start', 'inside']);
});

test('Day Closing timeline returns no activity without a valid Start Day', async () => {
  expect(filterTimelineForSession([{ at: '2026-10-05T09:00:00.000Z', text: 'event' }], {})).toEqual([]);
});
