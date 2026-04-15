const APP_UTC_OFFSET = "+07:00";
const APP_TIME_ZONE = "Asia/Jakarta";

function getDateParts(date: Date) {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: APP_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

  const parts = formatter.formatToParts(date);
  const year = parts.find((part) => part.type === "year")?.value ?? "0000";
  const month = parts.find((part) => part.type === "month")?.value ?? "01";
  const day = parts.find((part) => part.type === "day")?.value ?? "01";

  return { year, month, day };
}

export function formatDateInput(date: Date) {
  const { year, month, day } = getDateParts(date);
  return `${year}-${month}-${day}`;
}

export function getDateRangeForDay(dateInput: string) {
  return {
    start: new Date(`${dateInput}T00:00:00.000${APP_UTC_OFFSET}`),
    end: new Date(`${dateInput}T23:59:59.999${APP_UTC_OFFSET}`),
  };
}

export function shiftDateInput(dateInput: string, days: number) {
  const date = new Date(`${dateInput}T12:00:00.000${APP_UTC_OFFSET}`);
  date.setUTCDate(date.getUTCDate() + days);
  return formatDateInput(date);
}
