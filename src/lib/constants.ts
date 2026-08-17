export const DEFAULT_RESTAURANT_NAME = "Dark Kitchen";

export const RESTAURANT_ADDRESS =
  "N° 6, quartier les princesses, Résidence Miradore A, Rue Al Jounaid Arsat Lakbir, Casablanca";

export const RESTAURANT_MAPS_FALLBACK_URL = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
  `${DEFAULT_RESTAURANT_NAME}, ${RESTAURANT_ADDRESS}`
)}`;

// Legacy export for backward compatibility
export const RESTAURANT_MAPS_URL = RESTAURANT_MAPS_FALLBACK_URL;

/**
 * Returns the resolved Google Maps URL for the restaurant.
 * Prefers the admin-configured `googleMapsUrl` if present.
 * Otherwise falls back to Google Maps search with restaurant address and name.
 */
export function getRestaurantMapsUrl(
  settings?: {
    googleMapsUrl?: string | null;
    address?: string | null;
    name?: string | null;
  } | null
): string {
  if (settings?.googleMapsUrl && typeof settings.googleMapsUrl === "string") {
    const trimmed = settings.googleMapsUrl.trim();
    if (trimmed.length > 0) {
      try {
        const url = new URL(trimmed);
        if (url.protocol === "https:" || url.protocol === "http:") return url.toString();
      } catch {
        // Fall through to the encoded address search URL.
      }
    }
  }

  const address = settings?.address?.trim() || RESTAURANT_ADDRESS;
  const name = settings?.name?.trim() || DEFAULT_RESTAURANT_NAME;
  const query = `${name}, ${address}`;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

/**
 * Normalizes a phone number to WhatsApp international digit-only format.
 * - Removes all non-digit characters (spaces, dashes, parentheses, +, dots, etc.).
 * - Converts Moroccan local numbers starting with 0 (e.g. 06..., 07..., 05...) to international prefix 212 (e.g. 2126...).
 * - Handles leading double zero (00212... -> 212...).
 * - Prevents double prefixing (e.g. 21206... -> 2126..., 212212... -> 212...).
 * - Returns null if invalid or empty.
 */
export function normalizeWhatsAppNumber(rawNumber?: string | null): string | null {
  if (!rawNumber || typeof rawNumber !== "string") return null;

  const trimmed = rawNumber.trim();
  if (!trimmed) return null;

  // Extract all digit characters
  let digits = trimmed.replace(/\D/g, "");
  if (!digits) return null;

  // Handle leading 00 (e.g. 00212612345678 -> 212612345678)
  if (digits.startsWith("00")) {
    digits = digits.substring(2);
  }

  // Handle Moroccan local mobile / landline numbers starting with single 0 (10 digits total: 06..., 07..., 05...)
  if (digits.startsWith("0") && digits.length === 10) {
    digits = "212" + digits.substring(1);
  }

  // Handle accidental double prefix with leading zero: 2120612345678 (13 digits: 212 + 0 + 9 digits)
  if (digits.startsWith("2120") && digits.length === 13) {
    digits = "212" + digits.substring(4);
  }

  // Handle accidental double country code: 212212612345678 (15 digits)
  if (digits.startsWith("212212") && digits.length === 15) {
    digits = digits.substring(3);
  }

  // Basic sanity check: valid international phone numbers have between 8 and 15 digits
  if (digits.length < 8 || digits.length > 15) {
    return null;
  }

  return digits;
}

/**
 * Builds the official standard https://wa.me/PHONENUMBER link.
 * The link contains digits only.
 * Optional prefilled message is properly url-encoded if provided.
 */
export function getWhatsAppUrl(
  rawNumber?: string | null,
  message?: string | null
): string | null {
  const normalized = normalizeWhatsAppNumber(rawNumber);
  if (!normalized) return null;

  const baseUrl = `https://wa.me/${normalized}`;
  if (message && typeof message === "string" && message.trim().length > 0) {
    return `${baseUrl}?text=${encodeURIComponent(message.trim())}`;
  }
  return baseUrl;
}

/**
 * Returns active modifier groups with active options for a given product.
 */
export function getProductActiveModifierGroups(
  product: import("./types").Product | null | undefined
): import("./types").ProductModifierGroup[] {
  if (!product || !product.modifierGroups || !Array.isArray(product.modifierGroups)) {
    return [];
  }
  return product.modifierGroups
    .filter(
      (g) =>
        Boolean(g.active) &&
        Array.isArray(g.options) &&
        g.options.some((o) => Boolean(o.active))
    )
    .map((g) => ({
      ...g,
      options: g.options.filter((o) => Boolean(o.active)),
    }));
}

/**
 * Checks whether a product has any active modifier groups with active options.
 */
export function hasActiveModifiers(
  product: import("./types").Product | null | undefined
): boolean {
  return getProductActiveModifierGroups(product).length > 0;
}
