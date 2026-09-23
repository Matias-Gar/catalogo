import { getBrowserItem, setBrowserItem } from './browserStorage';

export const PUBLIC_COUNTRIES = [
  { slug: "bo", name: "Bolivia" },
  { slug: "cl", name: "Chile" },
];

export const PUBLIC_COUNTRY_STORAGE_KEY = "streetwear.public_country_slug";

export function isValidCountrySlug(slug) {
  return PUBLIC_COUNTRIES.some((country) => country.slug === slug);
}

export function hasCountrySlugInPath(pathname) {
  const firstSegment = String(pathname || "").split("/").filter(Boolean)[0] || "";
  return isValidCountrySlug(firstSegment);
}

export function getSavedPublicCountrySlug() {
  if (typeof window === "undefined") return "";
  const saved = getBrowserItem(PUBLIC_COUNTRY_STORAGE_KEY) || "";
  return isValidCountrySlug(saved) ? saved : "";
}

export function savePublicCountrySlug(slug) {
  if (typeof window === "undefined" || !isValidCountrySlug(slug)) return;
  setBrowserItem(PUBLIC_COUNTRY_STORAGE_KEY, slug);
}

export function getCountrySlugFromPath(pathname) {
  const firstSegment = String(pathname || "").split("/").filter(Boolean)[0] || "";
  if (isValidCountrySlug(firstSegment)) return firstSegment;
  return "bo";
}

export function stripCountryFromPath(pathname) {
  const parts = String(pathname || "").split("/").filter(Boolean);
  if (parts.length > 0 && PUBLIC_COUNTRIES.some((country) => country.slug === parts[0])) {
    return `/${parts.slice(1).join("/")}`;
  }
  return pathname || "/";
}

export function buildCountryPath(countrySlug, path = "/") {
  const slug = isValidCountrySlug(countrySlug) ? countrySlug : "bo";
  const cleanPath = String(path || "/").startsWith("/") ? path : `/${path}`;
  if (slug === "bo" && cleanPath === "/") return "/bo";
  return `/${slug}${cleanPath === "/" ? "" : cleanPath}`;
}
