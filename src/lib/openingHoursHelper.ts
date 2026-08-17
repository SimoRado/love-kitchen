import { RestaurantSettings } from "./types";

export const RESTAURANT_TIME_ZONE = "Africa/Casablanca";

export interface RestaurantOpenStatus {
  isOpen: boolean;
  statusText: string;
  statusDetail: string;
  badgeType: "open" | "closed";
}

const DAY_BY_SHORT_NAME: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

function casablancaClock(date: Date): { dayOfWeek: number; minutes: number } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: RESTAURANT_TIME_ZONE,
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return {
    dayOfWeek: DAY_BY_SHORT_NAME[values.weekday] ?? 0,
    minutes: Number(values.hour) * 60 + Number(values.minute),
  };
}

function zonedMidnightToUtc(year: number, month: number, day: number): Date {
  const desiredWallTime = Date.UTC(year, month - 1, day);
  let guess = desiredWallTime;
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: RESTAURANT_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });
  for (let iteration = 0; iteration < 3; iteration++) {
    const parts = Object.fromEntries(
      formatter.formatToParts(new Date(guess)).map((part) => [part.type, part.value])
    );
    const representedWallTime = Date.UTC(
      Number(parts.year), Number(parts.month) - 1, Number(parts.day),
      Number(parts.hour), Number(parts.minute), Number(parts.second)
    );
    guess = desiredWallTime - (representedWallTime - guess);
  }
  return new Date(guess);
}

export function getCasablancaDayBounds(currentDate: Date = new Date()): { start: Date; end: Date } {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone: RESTAURANT_TIME_ZONE,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(currentDate).map((part) => [part.type, part.value])
  );
  const year = Number(parts.year);
  const month = Number(parts.month);
  const day = Number(parts.day);
  const nextCalendarDay = new Date(Date.UTC(year, month - 1, day + 1));
  return {
    start: zonedMidnightToUtc(year, month, day),
    end: zonedMidnightToUtc(
      nextCalendarDay.getUTCFullYear(),
      nextCalendarDay.getUTCMonth() + 1,
      nextCalendarDay.getUTCDate()
    ),
  };
}

function timeToMinutes(value: string): number | null {
  const match = /^(?:[01]\d|2[0-3]):[0-5]\d$/.exec(value);
  if (!match) return null;
  const [hours, minutes] = value.split(":").map(Number);
  return hours * 60 + minutes;
}

function status(isOpen: boolean, detail: string): RestaurantOpenStatus {
  return {
    isOpen,
    statusText: isOpen ? "OPEN NOW" : "CURRENTLY CLOSED",
    statusDetail: detail,
    badgeType: isOpen ? "open" : "closed",
  };
}

/**
 * Resolves manual overrides first, then evaluates the weekly schedule using
 * Casablanca time regardless of the browser or server's local timezone.
 */
export function checkRestaurantOpen(
  settings: RestaurantSettings | null | undefined,
  currentDate: Date = new Date()
): RestaurantOpenStatus {
  if (!settings) return status(false, "Restaurant schedule unavailable");

  const rawOverride = settings.isOpenOverride as unknown;
  if (rawOverride === false || rawOverride === 0 || rawOverride === "false" || rawOverride === "0") {
    return status(false, "Online ordering is temporarily paused");
  }
  if (rawOverride === true || rawOverride === 1 || rawOverride === "true" || rawOverride === "1") {
    return status(true, "Open for online orders");
  }

  const hours = Array.isArray(settings.openingHours) ? settings.openingHours : [];
  if (hours.length === 0) return status(false, "Restaurant schedule unavailable");

  const { dayOfWeek, minutes } = casablancaClock(currentDate);
  const scheduleFor = (day: number) => hours.find((entry) => entry.dayOfWeek === day);
  const previous = scheduleFor((dayOfWeek + 6) % 7);

  if (previous && !previous.isClosed) {
    const previousOpen = timeToMinutes(previous.openTime);
    const previousClose = timeToMinutes(previous.closeTime);
    if (
      previousOpen !== null &&
      previousClose !== null &&
      previousClose < previousOpen &&
      minutes < previousClose
    ) {
      return status(true, `Open until ${previous.closeTime}`);
    }
  }

  const today = scheduleFor(dayOfWeek);
  if (today && !today.isClosed) {
    const open = timeToMinutes(today.openTime);
    const close = timeToMinutes(today.closeTime);
    if (open !== null && close !== null) {
      const overnight = close < open;
      if ((!overnight && minutes >= open && minutes < close) || (overnight && minutes >= open)) {
        return status(true, `Open today until ${today.closeTime}`);
      }
      if (minutes < open) return status(false, `Opens today at ${today.openTime}`);
    }
  }

  for (let offset = 1; offset <= 7; offset++) {
    const next = scheduleFor((dayOfWeek + offset) % 7);
    if (next && !next.isClosed && timeToMinutes(next.openTime) !== null) {
      const label = offset === 1 ? "tomorrow" : `on ${next.dayName || "the next open day"}`;
      return status(false, `Opens ${label} at ${next.openTime}`);
    }
  }

  return status(false, "Check schedule for opening hours");
}
