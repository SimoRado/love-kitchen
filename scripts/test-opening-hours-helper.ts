import assert from "node:assert";
import { checkRestaurantOpen } from "../src/lib/openingHoursHelper";
import { RestaurantSettings } from "../src/lib/types";

const mockSettings: RestaurantSettings = {
  id: "default",
  name: "Love Kitchen",
  subtitle: "Artisanal Kitchen & Delivery",
  phone: "+212 522 123456",
  address: "72 Boulevard Massira Khadra, Casablanca",
  currency: "MAD",
  deliveryFee: 15,
  isOpenOverride: null,
  isAutoHours: true,
  createdAt: new Date(),
  updatedAt: new Date(),
  openingHours: [
    { id: "1", dayOfWeek: 1, dayName: "Monday", openTime: "11:30", closeTime: "23:30", isClosed: false, settingsId: "default" },
    { id: "2", dayOfWeek: 2, dayName: "Tuesday", openTime: "11:30", closeTime: "23:30", isClosed: false, settingsId: "default" },
    { id: "3", dayOfWeek: 3, dayName: "Wednesday", openTime: "11:30", closeTime: "23:30", isClosed: false, settingsId: "default" },
    { id: "4", dayOfWeek: 4, dayName: "Thursday", openTime: "11:30", closeTime: "23:30", isClosed: false, settingsId: "default" },
    { id: "5", dayOfWeek: 5, dayName: "Friday", openTime: "11:30", closeTime: "23:30", isClosed: false, settingsId: "default" },
    { id: "6", dayOfWeek: 6, dayName: "Saturday", openTime: "11:30", closeTime: "23:30", isClosed: false, settingsId: "default" },
    { id: "0", dayOfWeek: 0, dayName: "Sunday", openTime: "12:00", closeTime: "23:00", isClosed: false, settingsId: "default" },
  ],
};

function runUnitTests() {
  console.log("🧪 Running checkRestaurantOpen unit tests...");

  // 1. Force Closed (isOpenOverride: false) even at 14:00 (normal open hours)
  const wednesday1400 = new Date(2026, 7, 19, 14, 0, 0); // Wednesday 14:00
  const forceClosedStatus = checkRestaurantOpen(
    { ...mockSettings, isOpenOverride: false },
    wednesday1400
  );
  console.log("Force Closed (14:00 inside hours):", forceClosedStatus);
  assert.strictEqual(forceClosedStatus.isOpen, false);
  assert.strictEqual(forceClosedStatus.statusText, "CURRENTLY CLOSED");
  assert.strictEqual(forceClosedStatus.statusDetail, "Online ordering is temporarily paused");

  // 2. Force Closed with numeric 0 from SQLite
  const forceClosedNumeric = checkRestaurantOpen(
    { ...mockSettings, isOpenOverride: 0 as unknown as boolean },
    wednesday1400
  );
  assert.strictEqual(forceClosedNumeric.isOpen, false);
  assert.strictEqual(forceClosedNumeric.statusText, "CURRENTLY CLOSED");

  // 3. Force Open (isOpenOverride: true) even at 04:00 (middle of night)
  const wednesday0400 = new Date(2026, 7, 19, 4, 0, 0); // Wednesday 04:00
  const forceOpenStatus = checkRestaurantOpen(
    { ...mockSettings, isOpenOverride: true },
    wednesday0400
  );
  console.log("Force Open (04:00 middle of night):", forceOpenStatus);
  assert.strictEqual(forceOpenStatus.isOpen, true);
  assert.strictEqual(forceOpenStatus.statusText, "OPEN NOW");
  assert.strictEqual(forceOpenStatus.statusDetail, "Open for online orders");

  // 4. Force Open with numeric 1 from SQLite
  const forceOpenNumeric = checkRestaurantOpen(
    { ...mockSettings, isOpenOverride: 1 as unknown as boolean },
    wednesday0400
  );
  assert.strictEqual(forceOpenNumeric.isOpen, true);
  assert.strictEqual(forceOpenNumeric.statusText, "OPEN NOW");

  // 5. Auto (isOpenOverride: null) at 14:00 (within schedule)
  const autoOpenStatus = checkRestaurantOpen(
    { ...mockSettings, isOpenOverride: null },
    wednesday1400
  );
  console.log("Auto Schedule (14:00 inside hours):", autoOpenStatus);
  assert.strictEqual(autoOpenStatus.isOpen, true);
  assert.strictEqual(autoOpenStatus.statusText, "OPEN NOW");
  assert.strictEqual(autoOpenStatus.statusDetail, "Open today until 23:30");

  // 6. Auto (isOpenOverride: null) at 04:00 (before opening)
  const autoClosedEarly = checkRestaurantOpen(
    { ...mockSettings, isOpenOverride: null },
    wednesday0400
  );
  console.log("Auto Schedule (04:00 before opening):", autoClosedEarly);
  assert.strictEqual(autoClosedEarly.isOpen, false);
  assert.strictEqual(autoClosedEarly.statusText, "CURRENTLY CLOSED");
  assert.strictEqual(autoClosedEarly.statusDetail, "Opens today at 11:30");

  const overnightSettings = {
    ...mockSettings,
    openingHours: mockSettings.openingHours.map((entry) =>
      entry.dayOfWeek === 5 ? { ...entry, closeTime: "00:30" } : entry
    ),
  };
  const saturdayAfterMidnight = new Date("2026-08-21T23:15:00.000Z");
  const overnightStatus = checkRestaurantOpen(overnightSettings, saturdayAfterMidnight);
  assert.strictEqual(overnightStatus.isOpen, true);
  assert.strictEqual(overnightStatus.statusDetail, "Open until 00:30");

  console.log("\n🎉 ALL UNIT TESTS PASSED FOR checkRestaurantOpen!");
}

runUnitTests();
