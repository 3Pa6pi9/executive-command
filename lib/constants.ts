export const PLATFORMS = ["twitter", "instagram", "facebook", "tiktok", "blog", "medium"];

export const AFRICAN_COUNTRIES = [
  "Ethiopia", "Kenya", "Nigeria", "Ghana", "South Africa",
  "Egypt", "Morocco", "Algeria", "Tunisia", "Uganda",
  "Tanzania", "Rwanda", "Senegal", "Cameroon", "Ivory Coast",
  "Zambia", "Zimbabwe", "DRC", "Sudan", "Angola"
];

export const EURASIA_SQUAD_COUNTRIES = [
  "UK", "Malaysia", "Russia", "Belurus", "Romania",
  "France", "Afghan", "Crotia", "Serbia", "New Serbia",
  "Germany", "Kosavo", "Greece", "Hungary"
];

export const ALL_COUNTRIES = [...AFRICAN_COUNTRIES, ...EURASIA_SQUAD_COUNTRIES];

// Parses TSV (Excel/Google Sheets copy-paste) or CSV lines into clean arrays
export function parseBulkRows(rawText: string): string[][] {
  return rawText
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean)
    .map(line => {
      const delimiter = line.includes("\t") ? "\t" : ",";
      return line.split(delimiter).map(cell => cell.trim().replace(/^"|"$/g, ""));
    });
}
