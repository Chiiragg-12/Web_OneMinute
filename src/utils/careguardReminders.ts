import { Capacitor } from '@capacitor/core';
import { api } from '../api/client';
import type { CareGuardDose, CareGuardPlanDetail } from '../types/api';

// Phone reminders for CareGuard on the installed Android/iOS apps, using local notifications.
// They are scheduled on the phone, so they fire even when OneMinute is closed and with no
// internet. They are a convenience, not a medical alarm: Android may delay inexact alarms by a
// few minutes, and reminders only cover the next few days (they are refreshed whenever the app opens).
// In a normal browser nothing is scheduled; the in-app reminders on the plan screen still work.

const DAYS_AHEAD = 3;
const MAX_NOTIFICATIONS = 60; // Android keeps a limited number of pending alarms per app
const CHECK_IN_HOUR = '09:00';
export const REMINDERS_CHANGED_EVENT = 'careguard:changed';

export type ReminderPermission = 'unsupported' | 'prompt' | 'granted' | 'denied';

async function plugin() {
  return (await import('@capacitor/local-notifications')).LocalNotifications;
}

export const remindersSupported = () => Capacitor.isNativePlatform();

export async function reminderPermission(): Promise<ReminderPermission> {
  if (!remindersSupported()) return 'unsupported';
  const status = await (await plugin()).checkPermissions();
  return status.display === 'granted' ? 'granted' : status.display === 'denied' ? 'denied' : 'prompt';
}

export async function requestReminderPermission(): Promise<ReminderPermission> {
  if (!remindersSupported()) return 'unsupported';
  const status = await (await plugin()).requestPermissions();
  return status.display === 'granted' ? 'granted' : status.display === 'denied' ? 'denied' : 'prompt';
}

/** Stable positive 31-bit id so rescheduling replaces rather than duplicates. */
export function notificationId(key: string): number {
  let hash = 5381;
  for (let index = 0; index < key.length; index += 1) hash = ((hash << 5) + hash + key.charCodeAt(index)) | 0;
  return Math.abs(hash) % 2_000_000_000 + 1;
}

function offsetMs(instant: Date, timeZone: string): number {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' }).formatToParts(instant).map((part) => [part.type, part.value]));
  return Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day), Number(parts.hour), Number(parts.minute), Number(parts.second)) - Math.floor(instant.getTime() / 1000) * 1000;
}

/** The instant at which the wall clock in `timeZone` reads `date` + `time` (DST-safe). */
export function zonedInstant(date: string, time: string, timeZone: string): Date {
  const [year, month, day] = date.split('-').map(Number);
  const [hour, minute] = time.split(':').map(Number);
  const wall = Date.UTC(year, month - 1, day, hour, minute, 0);
  let instant = new Date(wall - offsetMs(new Date(wall), timeZone));
  instant = new Date(wall - offsetMs(instant, timeZone));
  return instant;
}

export function addDays(date: string, days: number): string {
  const [year, month, day] = date.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
}

export interface PlannedNotification { id: number; title: string; body: string; at: Date; planId: string; kind: 'dose' | 'check_in' }

export function planNotifications(plan: CareGuardPlanDetail, dosesByDate: Map<string, CareGuardDose[]>, now: Date): PlannedNotification[] {
  const result: PlannedNotification[] = [];
  for (const [, doses] of dosesByDate) {
    for (const dose of doses) {
      if (dose.status === 'taken' || dose.status === 'missed') continue;
      const at = dose.status === 'postponed' && dose.snoozedUntil ? new Date(dose.snoozedUntil) : new Date(dose.scheduledFor);
      if (at.getTime() <= now.getTime()) continue;
      result.push({ id: notificationId(`dose|${dose.scheduleId}|${dose.scheduledFor}`), title: `Time for ${dose.medicineName}`, body: [dose.dosageText, dose.instructionText].filter(Boolean).join(' · ') || 'As prescribed by your doctor', at, planId: plan.id, kind: 'dose' });
    }
  }
  if (plan.checkInsEnabled) {
    for (let offset = 0; offset <= DAYS_AHEAD; offset += 1) {
      const date = addDays(plan.today.date, offset);
      if (offset === 0 && plan.today.checkIn) continue; // already answered today
      const at = zonedInstant(date, CHECK_IN_HOUR, plan.timezone);
      if (at.getTime() <= now.getTime()) continue;
      result.push({ id: notificationId(`checkin|${plan.id}|${date}`), title: 'How are you feeling today?', body: 'Open OneMinute to record your daily check-in.', at, planId: plan.id, kind: 'check_in' });
    }
  }
  return result;
}

/** Reads the active plans and replaces CareGuard's scheduled phone reminders. Never asks for permission by itself. */
export async function syncCareGuardReminders(now = new Date()): Promise<{ scheduled: number } | null> {
  if (!remindersSupported()) return null;
  if ((await reminderPermission()) !== 'granted') return null;
  const notifications = await plugin();

  const { plans } = await api.getCareGuardPlans();
  const planned: PlannedNotification[] = [];
  for (const summary of plans.filter((plan) => plan.active)) {
    const first = (await api.getCareGuardPlan(summary.id)).plan;
    const dosesByDate = new Map<string, CareGuardDose[]>([[first.today.date, first.today.doses]]);
    for (let offset = 1; offset <= DAYS_AHEAD; offset += 1) {
      const date = addDays(first.today.date, offset);
      dosesByDate.set(date, (await api.getCareGuardPlan(summary.id, date)).plan.today.doses);
    }
    planned.push(...planNotifications(first, dosesByDate, now));
  }
  planned.sort((a, b) => a.at.getTime() - b.at.getTime());
  const chosen = planned.slice(0, MAX_NOTIFICATIONS);

  // Replace only our own reminders, never anything else the app scheduled.
  const pending = await notifications.getPending();
  const ours = pending.notifications.filter((item) => (item.extra as { careguard?: boolean } | undefined)?.careguard);
  if (ours.length) await notifications.cancel({ notifications: ours.map((item) => ({ id: item.id })) });
  if (chosen.length) {
    await notifications.schedule({
      notifications: chosen.map((item) => ({
        id: item.id, title: item.title, body: item.body, schedule: { at: item.at, allowWhileIdle: true },
        // Inexact alarms: avoids sending people to the system "Alarms & reminders" screen. May be a few minutes late.
        isExactNotification: false,
        extra: { careguard: true, planId: item.planId, kind: item.kind },
      })),
    });
  }
  return { scheduled: chosen.length };
}

/** Components call this after recording a dose or check-in so the phone's reminders catch up. */
export function notifyRemindersChanged() {
  window.dispatchEvent(new Event(REMINDERS_CHANGED_EVENT));
}
