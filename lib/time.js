function getZoneNowParts(timeZone, date = new Date()) {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  });

  const parts = formatter.formatToParts(date);
  const hour24 = Number(parts.find((part) => part.type === "hour")?.value || "0");
  const minute = parts.find((part) => part.type === "minute")?.value || "00";

  return { hour24, minute };
}

function formatBoardTime(timeZone, date = new Date()) {
  const { hour24, minute } = getZoneNowParts(timeZone, date);
  const hour12 = hour24 % 12 === 0 ? 12 : hour24 % 12;

  let suffix = "AM";
  if (hour24 === 0) {
    suffix = "AM midnight";
  } else if (hour24 >= 1 && hour24 <= 11) {
    suffix = "AM";
  } else if (hour24 === 12) {
    suffix = "PM afternoon";
  } else {
    suffix = "PM";
  }

  return `${hour12}:${minute} ${suffix}`;
}

function formatZoneShortName(timeZone, date = new Date()) {
  try {
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone,
      timeZoneName: "short"
    });

    const parts = formatter.formatToParts(date);
    return parts.find((part) => part.type === "timeZoneName")?.value || "";
  } catch {
    return "";
  }
}

function formatIsoForFooter(date = new Date()) {
  return new Intl.DateTimeFormat("en-GB", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
    timeZone: "UTC"
  }).format(date).replace(",", "") + " UTC";
}

module.exports = {
  formatBoardTime,
  formatZoneShortName,
  formatIsoForFooter
};
