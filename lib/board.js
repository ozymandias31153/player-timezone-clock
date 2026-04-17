const { formatBoardTime, formatZoneShortName, formatIsoForFooter } = require("./time");

const ZONE_LIBRARY = [
  { id: "seoul", label: "Seoul", tz: "Asia/Seoul", defaultEnabled: true, order: 1 },
  { id: "pt", label: "PT", tz: "America/Los_Angeles", defaultEnabled: true, order: 2 },
  { id: "ct", label: "CT", tz: "America/Chicago", defaultEnabled: true, order: 3 },
  { id: "et", label: "ET", tz: "America/New_York", defaultEnabled: true, order: 4 },
  { id: "mt", label: "MT", tz: "America/Denver", defaultEnabled: true, order: 5 },
  { id: "india", label: "India", tz: "Asia/Kolkata", defaultEnabled: true, order: 6 },
  { id: "morocco", label: "Morocco", tz: "Africa/Casablanca", defaultEnabled: true, order: 7 },
  { id: "auckland", label: "Auckland", tz: "Pacific/Auckland", defaultEnabled: true, order: 8 },
  { id: "france", label: "France", tz: "Europe/Paris", defaultEnabled: true, order: 9 },
  { id: "shanghai", label: "Shanghai", tz: "Asia/Shanghai", defaultEnabled: true, order: 10 },
  { id: "bulgaria", label: "Bulgaria", tz: "Europe/Sofia", defaultEnabled: false, order: 11 }
];

function defaultCards() {
  return ZONE_LIBRARY.map((zone) => ({
    ...zone,
    enabled: zone.defaultEnabled,
    members: []
  }));
}

function normalizeCards(cards) {
  const incomingMap = new Map((Array.isArray(cards) ? cards : []).map((card) => [card.id, card]));

  return ZONE_LIBRARY.map((zone) => {
    const existing = incomingMap.get(zone.id) || {};
    return {
      id: zone.id,
      label: existing.label || zone.label,
      tz: existing.tz || zone.tz,
      enabled: typeof existing.enabled === "boolean" ? existing.enabled : zone.defaultEnabled,
      order: typeof existing.order === "number" ? existing.order : zone.order,
      members: Array.isArray(existing.members) ? Array.from(new Set(existing.members)) : []
    };
  }).sort((a, b) => a.order - b.order);
}

function getEnabledCards(board) {
  return normalizeCards(board.cards).filter((card) => card.enabled);
}

function getDisabledCards(board) {
  return normalizeCards(board.cards).filter((card) => !card.enabled);
}

function getCard(board, cardId) {
  return normalizeCards(board.cards).find((card) => card.id === cardId) || null;
}

function patchBoardCards(board, updater) {
  const cards = normalizeCards(board.cards);
  const updatedCards = updater(cards) || cards;
  return {
    ...board,
    cards: normalizeCards(updatedCards)
  };
}

function buildBoardPayload(board, date = new Date()) {
  const enabledCards = getEnabledCards(board);
  const fields = enabledCards.map((card) => ({
    name: buildFieldName(card, date),
    value: buildFieldValue(card, date),
    inline: true
  }));

  if (!fields.length) {
    fields.push({
      name: "No active zones",
      value: "Use **Add Zone** below.",
      inline: false
    });
  }

  const embed = {
    title: board.title || "Timezone Board",
    description: "Live clock board for your selected zones. Member mentions are rendered inside embed fields so routine refreshes do not keep re-pinging people.",
    color: 5793266,
    fields,
    footer: {
      text: `Updated ${formatIsoForFooter(date)}`
    },
    timestamp: date.toISOString()
  };

  return {
    content: "",
    allowed_mentions: {
      parse: []
    },
    embeds: [embed],
    components: buildControlRows(board)
  };
}

function buildFieldName(card, date) {
  const zoneShortName = formatZoneShortName(card.tz, date);
  return zoneShortName ? `${card.label} (${zoneShortName})` : card.label;
}

function buildFieldValue(card, date) {
  const timeLine = `**${formatBoardTime(card.tz, date)}**`;

  if (!Array.isArray(card.members) || !card.members.length) {
    return `${timeLine}\n—`;
  }

  const mentionLines = card.members.map((id) => `<@${id}>`);
  const lines = [timeLine];
  let hiddenCount = 0;

  for (const mentionLine of mentionLines) {
    const candidate = `${lines.join("\n")}\n${mentionLine}`;
    if (candidate.length > 1000) {
      hiddenCount += 1;
      continue;
    }
    lines.push(mentionLine);
  }

  if (hiddenCount > 0) {
    lines.push(`+${hiddenCount} more`);
  }

  return lines.join("\n");
}

function buildControlRows(board) {
  const hasDisabled = getDisabledCards(board).length > 0;
  const hasEnabled = getEnabledCards(board).length > 0;

  return [
    {
      type: 1,
      components: [
        button("board:add-zone", "Add Zone", 1, !hasDisabled),
        button("board:remove-zone", "Remove Zone", 4, !hasEnabled),
        button("board:add-member", "Add Member", 2, !hasEnabled),
        button("board:remove-member", "Remove Member", 2, !hasEnabled),
        button("board:refresh", "Refresh", 3, false)
      ]
    }
  ];
}

function button(customId, label, style, disabled) {
  return {
    type: 2,
    custom_id: customId,
    label,
    style,
    disabled
  };
}

function buildZoneSelect(customId, cards, placeholder, min = 1) {
  return {
    type: 1,
    components: [
      {
        type: 3,
        custom_id: customId,
        placeholder,
        min_values: min,
        max_values: Math.min(cards.length, 25),
        options: cards.slice(0, 25).map((card) => ({
          label: card.label,
          value: card.id,
          description: card.tz
        }))
      }
    ]
  };
}

function buildUserSelect(customId, placeholder, maxValues = 10) {
  return {
    type: 1,
    components: [
      {
        type: 5,
        custom_id: customId,
        placeholder,
        min_values: 1,
        max_values: Math.min(maxValues, 25)
      }
    ]
  };
}

module.exports = {
  defaultCards,
  normalizeCards,
  getEnabledCards,
  getDisabledCards,
  getCard,
  patchBoardCards,
  buildBoardPayload,
  buildZoneSelect,
  buildUserSelect,
  ZONE_LIBRARY
};
