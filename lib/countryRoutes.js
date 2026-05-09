export const PUBLIC_COUNTRIES = [
  { slug: "bo", name: "Bolivia" },
  { slug: "cl", name: "Chile" },
];

export function getCountrySlugFromPath(pathname) {
  const firstSegment = String(pathname || "").split("/").filter(Boolean)[0] || "";
  return PUBLIC_COUNTRIES.some((country) => country.slug === firstSegment) ? firstSegment : "bo";
}

export function stripCountryFromPath(pathname) {
  const parts = String(pathname || "").split("/").filter(Boolean);
  if (parts.length > 0 && PUBLIC_COUNTRIES.some((country) => country.slug === parts[0])) {
    return `/${parts.slice(1).join("/")}`;
  }
  return pathname || "/";
}

export function buildCountryPath(countrySlug, path = "/") {
  const slug = PUBLIC_COUNTRIES.some((country) => country.slug === countrySlug) ? countrySlug : "bo";
  const cleanPath = String(path || "/").startsWith("/") ? path : `/${path}`;
  if (slug === "bo" && cleanPath === "/") return "/bo";
  return `/${slug}${cleanPath === "/" ? "" : cleanPath}`;
}
