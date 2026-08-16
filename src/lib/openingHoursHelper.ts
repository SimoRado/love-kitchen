import { RestaurantSettings, OpeningHour } from "./types";

export interface RestaurantOpenStatus {
  isOpen: boolean;
  statusText: string;
  statusDetail: string;
  badgeType: "open" | "closed";
}

/**
 * Checks whether the restaurant is currently OPEN or CLOSED
 * respecting manual overrides and weekly schedule.
 */
export function checkRestaurantOpen(
  settings: RestaurantSettings | null | undefined,
  currentDate: Date = new Date()
): RestaurantOpenStatus {
  if (!settings) {
    return {
      isOpen: false,
      statusText: "CURRENTLY CLOSED",
      statusDetail: "Restaurant schedule unavailable",
      badgeType: "closed",
    };
  }

  // 1. Check Manual Overrides
  if (settings.isOpenOverride === true) {
    return {
      isOpen: true,
      statusText: "OPEN NOW",
      statusDetail: "Accepting orders right now",
      badgeType: "open",
    };
  }

  if (settings.isOpenOverride === false) {
    return {
      isOpen: false,
      statusText: "CURRENTLY CLOSED",
      statusDetail: "Online ordering is temporarily paused",
      badgeType: "closed",
    };
  }

  // 2. Schedule-based check
  const hoursList = settings.openingHours || [];
  if (hoursList.length === 0) {
    return {
      isOpen: true,
      statusText: "OPEN NOW",
      statusDetail: "Open for orders",
      badgeType: "open",
    };
  }

  const currentDayOfWeek = currentDate.getDay(); // 0 = Sunday, 1 = Monday, ...
  const currentHours = String(currentDate.getHours()).padStart(2, "0");
  const currentMinutes = String(currentDate.getMinutes()).padStart(2, "0");
  const currentTimeStr = `${currentHours}:${currentMinutes}`;

  const todaySchedule = hoursList.find((h) => h.dayOfWeek === currentDayOfWeek);

  const getNextOpenInfo = (): string => {
    // Find next day that is open
    for (let offset = 1; offset <= 7; offset++) {
      const nextDay = (currentDayOfWeek + offset) % 7;
      const nextSched = hoursList.find((h) => h.dayOfWeek === nextDay);
      if (nextSched && !nextSched.isClosed && nextSched.openTime) {
        const dayLabel = offset === 1 ? "tomorrow" : `on ${nextSched.dayName || "next open day"}`;
        return `Opens ${dayLabel} at ${nextSched.openTime}`;
      }
    }
    return "Check schedule for opening hours";
  };

  if (!todaySchedule || todaySchedule.isClosed) {
    return {
      isOpen: false,
      statusText: "CURRENTLY CLOSED",
      statusDetail: `Closed today. ${getNextOpenInfo()}`,
      badgeType: "closed",
    };
  }

  const { openTime, closeTime } = todaySchedule;
  const isOvernight = closeTime < openTime;

  let isCurrentlyOpen = false;
  if (isOvernight) {
    // e.g. 18:00 to 02:00
    isCurrentlyOpen = currentTimeStr >= openTime || currentTimeStr < closeTime;
  } else {
    // e.g. 11:30 to 23:30
    isCurrentlyOpen = currentTimeStr >= openTime && currentTimeStr < closeTime;
  }

  if (isCurrentlyOpen) {
    return {
      isOpen: true,
      statusText: "OPEN NOW",
      statusDetail: `Open today until ${closeTime}`,
      badgeType: "open",
    };
  }

  if (currentTimeStr < openTime) {
    return {
      isOpen: false,
      statusText: "CURRENTLY CLOSED",
      statusDetail: `Opens today at ${openTime}`,
      badgeType: "closed",
    };
  }

  return {
    isOpen: false,
    statusText: "CURRENTLY CLOSED",
    statusDetail: `Closed for today. ${getNextOpenInfo()}`,
    badgeType: "closed",
  };
}
