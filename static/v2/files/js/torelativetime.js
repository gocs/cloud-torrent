const lang = Intl.DateTimeFormat().resolvedOptions().locale
const SECOND_MS = 1000;
const MINUTE_MS = SECOND_MS * 60;
const HOUR_MS = MINUTE_MS * 60;
const DAY_MS = HOUR_MS * 24;
const WEEK_MS = DAY_MS * 7;
const MONTH_MS = DAY_MS * 30;
const YEAR_MS = DAY_MS * 365;

const fmt = {
    "year": YEAR_MS,
    "month": MONTH_MS,
    "week": WEEK_MS,
    "day": DAY_MS,
    "hour": HOUR_MS,
    "minute": MINUTE_MS,
    "second": SECOND_MS,
}

function toRelativeTime(date) {
    const rtf = new Intl.RelativeTimeFormat(lang, { numeric: "auto" });

    const creation = new Date(date).getTime();
    const now = new Date().getTime();

    let odiff = creation - now
    let diff
    let unit
    for (const [u, v] of Object.entries(fmt)) {
        unit = u
        diff = Math.ceil(odiff / v)
        if (diff) break;
    }

    return rtf.format(diff, unit);
}