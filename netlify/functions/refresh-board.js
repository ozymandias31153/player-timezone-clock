require("dotenv").config();

const { buildBoardPayload } = require("../../lib/board");
const { editMessage } = require("../../lib/discord");
const { getBoard, saveBoard } = require("../../lib/store");

exports.handler = async () => {
  try {
    const board = await getBoard();

    if (!board?.channelId || !board?.messageId) {
      return ok("Board not initialized yet.");
    }

    const now = new Date();
    await editMessage(board.channelId, board.messageId, buildBoardPayload(board, now));
    await saveBoard({
      ...board,
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
