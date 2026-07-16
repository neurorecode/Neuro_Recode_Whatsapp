interface DayHours {
  day: number; // 0 = Sunday … 6 = Saturday
  enabled: boolean;
  open: string; // "09:00"
  close: string; // "18:00"
}

const WD: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

/**
 * Is "now" inside the configured business hours (in the config's timezone)?
 * With no hours configured we treat the business as always open (away never fires).
 */
export function isWithinBusinessHours(config: {
  timezone?: string | null;
  businessHours?: unknown;
}): boolean {
  const hours = config.businessHours as DayHours[] | null | undefined;
  if (!Array.isArray(hours) || hours.length === 0) return true;

  const tz = config.timezone || 'Asia/Kolkata';
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    hour12: false,
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).formatToParts(new Date());
  const map: Record<string, string> = {};
  for (const p of parts) map[p.type] = p.value;

  const day = WD[map.weekday];
  if (day === undefined) return true;
  const nowMin = (parseInt(map.hour, 10) % 24) * 60 + parseInt(map.minute, 10);

  const today = hours.find((h) => h.day === day);
  if (!today || !today.enabled) return false;

  const [oh, om] = today.open.split(':').map((n) => parseInt(n, 10));
  const [ch, cm] = today.close.split(':').map((n) => parseInt(n, 10));
  const openMin = oh * 60 + (om || 0);
  const closeMin = ch * 60 + (cm || 0);
  return nowMin >= openMin && nowMin < closeMin;
}
