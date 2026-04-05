const { getDb } = require("./firebase");
const { defaultCards, normalizeCards } = require("./board");

const COLLECTION = "boards";
const DOC_ID = "main";

async function getBoard() {
  const snapshot = await getDb().collection(COLLECTION).doc(DOC_ID).get();
  if (!snapshot.exists) {
    return null;
  }

  const data = snapshot.data();
  return {
    title: "Timezone Board",
    adminRoleIds: [],
    cards: defaultCards(),
    ...data,
    cards: normalizeCards(data.cards)
  };
}

async function saveBoard(board) {
  const payload = {
    title: board.title || "Timezone Board",
    guildId: board.guildId,
    channelId: board.channelId,
    messageId: board.messageId,
    applicationId: board.applicationId || process.env.DISCORD_APPLICATION_ID || null,
    adminRoleIds: Array.isArray(board.adminRoleIds) ? Array.from(new Set(board.adminRoleIds)) : [],
    cards: normalizeCards(board.cards),
    createdAt: board.createdAt || new Date().toISOString(),
    createdBy: board.createdBy || null,
    lastRenderedAt: board.lastRenderedAt || null,
    lastUpdatedBy: board.lastUpdatedBy || null
  };

  await getDb().collection(COLLECTION).doc(DOC_ID).set(payload, { merge: true });
  return payload;
}

function buildInitialBoard({ guildId, channelId, createdBy }) {
  return {
    title: "Timezone Board",
    guildId,
    channelId,
    messageId: null,
    applicationId: process.env.DISCORD_APPLICATION_ID || null,
    adminRoleIds: [],
    cards: defaultCards(),
    createdAt: new Date().toISOString(),
    createdBy,
    lastRenderedAt: null,
    lastUpdatedBy: createdBy || null
  };
}

module.exports = {
  getBoard,
  saveBoard,
  buildInitialBoard
};
