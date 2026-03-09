const DEFAULT_CURRENCY = "USD";

const SYMBOL_TO_CODE: Record<string, string> = {
  "$": "USD",
  "A$": "AUD",
  "CA$": "CAD",
  "HK$": "HKD",
  "MX$": "MXN",
  "NZ$": "NZD",
  "R$": "BRL",
  "£": "GBP",
  "¥": "JPY",
  "₩": "KRW",
  "₪": "ILS",
  "₫": "VND",
  "€": "EUR",
  "₱": "PHP",
  "₹": "INR",
  "US$": "USD",
  "S$": "SGD",
  "NT$": "TWD",
  "CN¥": "CNY",
};

const NUMBER_EXTRACTOR = /[+-]?(?:\d{1,3}(?:[\s,]\d{3})+|\d+)(?:[.,]\d+)?/;
const ISO_CODE = /[A-Z]{3}/;

const normalizeSpaces = (value: string): string =>
  value.replace(/\u00A0|\u202F/g, " ").trim();

const normalizeAmountToken = (value: string): string => {
  const compact = normalizeSpaces(value).replace(/\s/g, "");
  const hasComma = compact.includes(",");
  const hasDot = compact.includes(".");

  if (hasComma && hasDot) {
    return compact.lastIndexOf(",") > compact.lastIndexOf(".")
      ? compact.replace(/\./g, "").replace(/,/g, ".")
      : compact.replace(/,/g, "");
  }

  if (hasComma && !hasDot) {
    const parts = compact.split(",");
    return parts.at(-1)?.length === 3 ? parts.join("") : parts.join(".");
  }

  return compact;
};

const resolveCurrencyCode = (symbolPart: string, fullInput: string): string => {
  const compactSymbol = normalizeSpaces(symbolPart).replace(/\s/g, "");

  if (compactSymbol in SYMBOL_TO_CODE) {
    const code = SYMBOL_TO_CODE[compactSymbol as keyof typeof SYMBOL_TO_CODE];
    if (code) {
      return code;
    }
  }

  if (compactSymbol.length === 3 && /^[A-Za-z]{3}$/.test(compactSymbol)) {
    return compactSymbol.toUpperCase();
  }

  const embedded = compactSymbol.toUpperCase().match(ISO_CODE)?.[0];
  if (embedded) {
    return embedded;
  }

  const embeddedFromRaw = fullInput.toUpperCase().match(ISO_CODE)?.[0];
  if (embeddedFromRaw) {
    return embeddedFromRaw;
  }

  if (compactSymbol.includes("¥")) {
    return "JPY";
  }

  return DEFAULT_CURRENCY;
};

export const parseCurrency = (
  rawInput: string | null | undefined,
): { amountValue: number; currency: string } => {
  if (!rawInput || !rawInput.trim()) {
    return { amountValue: 0, currency: DEFAULT_CURRENCY };
  }

  const normalized = normalizeSpaces(rawInput);
  const numberMatch = normalized.match(NUMBER_EXTRACTOR)?.[0];
  if (!numberMatch) {
    return { amountValue: 0, currency: resolveCurrencyCode(normalized, normalized) };
  }

  const idx = normalized.indexOf(numberMatch);
  const before = normalized.slice(0, idx);
  const after = normalized.slice(idx + numberMatch.length);
  const amountValue = Number.parseFloat(normalizeAmountToken(numberMatch));

  return {
    amountValue: Number.isFinite(amountValue) ? amountValue : 0,
    currency: resolveCurrencyCode(`${before}${after}`, normalized),
  };
};
