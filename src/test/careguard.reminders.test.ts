import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  native: { value: true },
  plugin: { checkPermissions: vi.fn(), requestPermissions: vi.fn(), getPending: vi.fn(), cancel: vi.fn(), schedule: vi.fn() },
  api: { getCareGuardPlans: vi.fn(), getCareGuardPlan: vi.fn() },
}));
vi.mock('@capacitor/core', () => ({ Capacitor: { isNativePlatform: () => mocks.native.value } }));
vi.mock('@capacitor/local-notifications', () => ({ LocalNotifications: mocks.plugin }));
vi.mock('../api/client', () => ({ api: mocks.api }));

import { addDays, notificationId, planNotifications, syncCareGuardReminders, zonedInstant } from '../utils/careguardReminders';

const NOW = new Date('2026-10-12T05:00:00.000Z'); // 10:30 in India
const dose = (overrides = {}) => ({ scheduleId: 's1', medicineName: 'Paracetamol', dosageText: '500 mg', instructionText: 'After meals', scheduledFor: '2026-10-12T14:30:00.000Z', status: 'pending', snoozedUntil: null, overdue: false, ...overrides });
const plan = (overrides = {}) => ({ id: 'plan-1', timezone: 'Asia/Kolkata', checkInsEnabled: true, today: { date: '2026-10-12', doses: [], checkIn: null }, ...overrides }) as never;

beforeEach(() => {
  vi.clearAllMocks();
  mocks.native.value = true;
  mocks.plugin.checkPermissions.mockResolvedValue({ display: 'granted' });
  mocks.plugin.getPending.mockResolvedValue({ notifications: [] });
  mocks.api.getCareGuardPlans.mockResolvedValue({ plans: [{ id: 'plan-1', active: true }], safety: {} });
  mocks.api.getCareGuardPlan.mockImplementation(async (_id: string, date?: string) => ({ plan: plan({ today: { date: date ?? '2026-10-12', doses: date ? [] : [dose()], checkIn: null } }) }));
});

describe('reminder time helpers', () => {
  it('keeps clinic-local times through daylight saving', () => {
    expect(zonedInstant('2026-10-12', '09:00', 'Asia/Kolkata').toISOString()).toBe('2026-10-12T03:30:00.000Z');
    expect(zonedInstant('2026-03-08', '09:00', 'America/New_York').toISOString()).toBe('2026-03-08T13:00:00.000Z');
    expect(addDays('2026-10-30', 3)).toBe('2026-11-02');
  });

  it('gives the same id for the same dose and different ids for different ones', () => {
    expect(notificationId('dose|a|1')).toBe(notificationId('dose|a|1'));
    expect(notificationId('dose|a|1')).not.toBe(notificationId('dose|a|2'));
    expect(notificationId('x')).toBeGreaterThan(0);
  });
});

describe('what gets scheduled', () => {
  it('schedules future pending doses and snoozed doses at their snooze time, but not taken, missed or past ones', () => {
    const doses = [
      dose({ scheduledFor: '2026-10-12T14:30:00.000Z' }),
      dose({ scheduledFor: '2026-10-12T02:30:00.000Z' }),
      dose({ scheduledFor: '2026-10-12T15:30:00.000Z', status: 'taken' }),
      dose({ scheduledFor: '2026-10-12T16:30:00.000Z', status: 'missed' }),
      dose({ scheduledFor: '2026-10-12T08:30:00.000Z', status: 'postponed', snoozedUntil: '2026-10-12T09:00:00.000Z' }),
    ];
    const result = planNotifications(plan({ checkInsEnabled: false }), new Map([['2026-10-12', doses as never]]), NOW);
    expect(result.map((item) => item.at.toISOString()).sort()).toEqual(['2026-10-12T09:00:00.000Z', '2026-10-12T14:30:00.000Z']);
    expect(result[0].title).toBe('Time for Paracetamol');
  });

  it('adds a 9 AM check-in reminder per day, skipping today once it has been answered', () => {
    const open = planNotifications(plan(), new Map(), new Date('2026-10-12T01:00:00.000Z'));
    expect(open.filter((item) => item.kind === 'check_in').map((item) => item.at.toISOString())).toEqual(['2026-10-12T03:30:00.000Z', '2026-10-13T03:30:00.000Z', '2026-10-14T03:30:00.000Z', '2026-10-15T03:30:00.000Z']);
    const answered = planNotifications(plan({ today: { date: '2026-10-12', doses: [], checkIn: { feeling: 'better' } } }), new Map(), new Date('2026-10-12T01:00:00.000Z'));
    expect(answered.filter((item) => item.kind === 'check_in')).toHaveLength(3);
  });

  it('adds no check-in reminders when the doctor turned check-ins off', () => {
    expect(planNotifications(plan({ checkInsEnabled: false }), new Map(), NOW)).toEqual([]);
  });
});

describe('syncing with the phone', () => {
  it('does nothing in a browser', async () => {
    mocks.native.value = false;
    expect(await syncCareGuardReminders(NOW)).toBeNull();
    expect(mocks.plugin.schedule).not.toHaveBeenCalled();
  });

  it('never asks for permission on its own, and schedules nothing without it', async () => {
    mocks.plugin.checkPermissions.mockResolvedValue({ display: 'prompt' });
    expect(await syncCareGuardReminders(NOW)).toBeNull();
    expect(mocks.plugin.requestPermissions).not.toHaveBeenCalled();
    expect(mocks.plugin.schedule).not.toHaveBeenCalled();
  });

  it('replaces only its own earlier reminders and schedules inexact, idle-safe alarms', async () => {
    mocks.plugin.getPending.mockResolvedValue({ notifications: [{ id: 11, extra: { careguard: true } }, { id: 22, extra: { other: true } }, { id: 33 }] });
    const result = await syncCareGuardReminders(NOW);
    expect(mocks.plugin.cancel).toHaveBeenCalledWith({ notifications: [{ id: 11 }] });
    const scheduled = mocks.plugin.schedule.mock.calls[0][0].notifications;
    expect(result?.scheduled).toBe(scheduled.length);
    expect(scheduled.every((item: { isExactNotification: boolean; extra: { careguard: boolean } }) => item.isExactNotification === false && item.extra.careguard === true)).toBe(true);
    expect(scheduled.some((item: { title: string }) => item.title === 'Time for Paracetamol')).toBe(true);
  });

  it('skips plans that are no longer active', async () => {
    mocks.api.getCareGuardPlans.mockResolvedValue({ plans: [{ id: 'plan-1', active: false }], safety: {} });
    expect(await syncCareGuardReminders(NOW)).toEqual({ scheduled: 0 });
    expect(mocks.api.getCareGuardPlan).not.toHaveBeenCalled();
    expect(mocks.plugin.schedule).not.toHaveBeenCalled();
  });
});
