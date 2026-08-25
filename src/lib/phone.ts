import {
  getCountries,
  getCountryCallingCode,
  isValidPhoneNumber,
  parsePhoneNumberFromString,
  type CountryCode,
} from "libphonenumber-js";

export type PhoneCountry = { iso: CountryCode; name: string; dialCode: string };

const regionNames = typeof Intl.DisplayNames === "function"
  ? new Intl.DisplayNames(["en"], { type: "region" })
  : null;

export const PHONE_COUNTRIES: PhoneCountry[] = getCountries()
  .map((iso) => ({ iso, name: regionNames?.of(iso) ?? iso, dialCode: getCountryCallingCode(iso) }))
  .sort((first, second) => first.name.localeCompare(second.name));

export const DEFAULT_PHONE_COUNTRY = PHONE_COUNTRIES.find((country) => country.iso === "IN")!;

export function countryForIso(iso: string | undefined) {
  return PHONE_COUNTRIES.find((country) => country.iso === iso) ?? DEFAULT_PHONE_COUNTRY;
}

export function phoneMaxLength(country: PhoneCountry) {
  return Math.max(4, 15 - country.dialCode.length);
}

export function toE164(country: PhoneCountry, nationalNumber: string) {
  const input = nationalNumber.replace(/\D/g, "").slice(0, phoneMaxLength(country));
  return parsePhoneNumberFromString(input, country.iso)?.number ?? `+${country.dialCode}${input}`;
}

export function splitPhone(value: string | null | undefined) {
  const digits = (value ?? "").replace(/\D/g, "");
  if (!digits) return { country: DEFAULT_PHONE_COUNTRY, nationalNumber: "" };
  // Legacy values were India-only before international support.
  if (!(value ?? "").trim().startsWith("+")) {
    return { country: DEFAULT_PHONE_COUNTRY, nationalNumber: digits.slice(0, phoneMaxLength(DEFAULT_PHONE_COUNTRY)) };
  }
  const parsed = parsePhoneNumberFromString(value!);
  const country = countryForIso(parsed?.country);
  return {
    country,
    nationalNumber: parsed?.nationalNumber ?? digits.slice(country.dialCode.length, country.dialCode.length + phoneMaxLength(country)),
  };
}

export function isValidInternationalPhone(value: string) {
  if (value.startsWith("+91")) return /^\+91[6-9]\d{9}$/.test(value);
  return isValidPhoneNumber(value);
}

export function displayPhone(value: string | null | undefined) {
  if (!value) return "Not added";
  return value.trim().startsWith("+") ? value : `+91 ${value}`;
}
