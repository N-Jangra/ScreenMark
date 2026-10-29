// Date formatting shared by every page (Settings → Appearance → Date format).
(() => {
  let format = "auto";
  const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const pad = value => String(value).padStart(2, "0");
  const render = (year, month, day) => {
    switch (format) {
      case "dmy": return `${pad(day)}/${pad(month)}/${year}`;
      case "mdy": return `${pad(month)}/${pad(day)}/${year}`;
      case "iso": return `${year}-${pad(month)}-${pad(day)}`;
      case "long": return `${day} ${MONTHS[month - 1]} ${year}`;
      default: return new Date(year, month - 1, day).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
    }
  };
  // Turns every YYYY-MM-DD inside a string into the chosen format ("2012-07-15 · 60 min" → "15/07/2012 · 60 min").
  const text = value => String(value ?? "").replace(/\b(\d{4})-(\d{2})-(\d{2})\b/g, (all, y, m, d) => render(Number(y), Number(m), Number(d)));
  const date = value => {
    if (value === "" || value == null) return "";
    const parsed = value instanceof Date ? value : new Date(typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T00:00:00` : value);
    return Number.isNaN(parsed.getTime()) ? String(value) : render(parsed.getFullYear(), parsed.getMonth() + 1, parsed.getDate());
  };
  const withWeekday = value => { const parsed = value instanceof Date ? value : new Date(value); return Number.isNaN(parsed.getTime()) ? "" : `${parsed.toLocaleDateString(undefined, { weekday: "short" })}, ${date(parsed)}`; };
  window.SplitAppDates = Object.freeze({ setFormat: value => { format = ["auto", "dmy", "mdy", "iso", "long"].includes(value) ? value : "auto"; }, text, date, withWeekday });
})();
