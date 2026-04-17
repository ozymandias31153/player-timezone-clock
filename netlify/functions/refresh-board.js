require("dotenv").config();

const { buildBoardPayload } = require("../../lib/board");
const { createMessage, editMessage, pinMessage } = require("../../lib/discord");
const { getBoard, saveBoard } = require("../../lib/store");

exports.handler = async () => {
  try {
    const board = await getBoard();

    if (!board?.channelId || !board?.messageId) {
      return ok("Board not initialized yet.");
    }

    const now = new Date();
    const payload = buildBoardPayload(board, now);
    let messageId = board.messageId;

    try {
      await editMessage(board.channelId, board.messageId, payload);
    } catch (error) {
      if (!isUnknownMessageError(error)) {
        throw error;
      }

      const message = await createMessage(board.channelId, payload);
      await pinMessage(board.channelId, message.id);
      messageId = message.id;
    }

    await saveBoard({
      ...board,
      messageId,
      lastRenderedAt: now.toISOString()
    });

    return ok(`Board refreshed at ${now.toISOString()}`);
  } catch (error) {
    console.error(error);
    return {
      statusCode: 500,
      body: error.message || "Scheduled refresh failed."
    };
  }
};

function ok(message) {
  return {
    statusCode: 200,
    body: message
  };
}

function isUnknownMessageError(error) {
  const text = String(error?.message || error || "");
  return text.includes("Unknown Message") || text.includes("10008");
}
