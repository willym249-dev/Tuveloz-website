// SQLite CURRENT_TIMESTAMP is UTC but omits the timezone marker. Browsers
// otherwise interpret that value as local time (or reject the space format).
export function storedTimestamp(value: string) {
  const normalized = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}(?:\.\d+)?$/.test(value)
    ? `${value.replace(" ", "T")}Z`
    : value;
  return new Date(normalized);
}
