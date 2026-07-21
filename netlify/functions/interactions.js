require("dotenv").config();

const nacl = require("tweetnacl");
const {
  buildBoardPayload,
  buildZoneSelect,
  buildUserSelect,
  buildReorderControls,
  getDisabledCards,
  getEnabledCards,
  getCard,
  patchBoardCards
} = require("../../lib/board");
const { createMessage, editMessage, pinMessage } = require("../../lib/discord");
const { hasBoardAccess } = require("../../lib/permissions");
const { getBoard, saveBoard, buildInitialBoard } = require("../../lib/store");

exports.handler = async (event) => {
  try {
    if (!verifyDiscordRequest(event)) {
      return response(401, "invalid request signature");
    }

    const interaction = JSON.parse(event.body || "{}");
    interaction.user = interaction.user || interaction.member?.user || null;

    if (interaction.type === 1) {
      return json({ type: 1 });
    }

    if (interaction.type === 2) {
      return await handleCommand(interaction);
    }

    if (interaction.type === 3) {
      return await handleComponent(interaction);
    }

    return interactionMessage("Unsupported interaction type.");
  } catch (error) {
    console.error(error);
    return interactionMessage(`Error: ${error.message || "Unknown failure."}`);
  }
};

async function handleCommand(interaction) {
  const commandName = interaction.data?.name;
  const existingBoard = await getBoard();
  const permissionBoard = existingBoard || {};

  if (["board-init", "board-refresh", "board-admin-role-add", "board-admin-role-remove"].includes(commandName)) {
    if (!hasBoardAccess(interaction, permissionBoard)) {
      return interactionMessage("You do not have permission to manage this board.");
    }
  }

  switch (commandName) {
    case "board-init":
      return await handleBoardInit(interaction, existingBoard);
    case "board-refresh":
      return await handleBoardRefresh(interaction, existingBoard);
    case "board-admin-role-add":
      return await handleAdminRoleAdd(interaction, existingBoard);
    case "board-admin-role-remove":
      return await handleAdminRoleRemove(interaction, existingBoard);
    default:
      return interactionMessage(`Unknown command: ${commandName}`);
  }
}

async function handleComponent(interaction) {
  const board = await getBoard();
  if (!board) {
    return interactionMessage("Run /board-init in the target channel first.");
  }

  if (!hasBoardAccess(interaction, board)) {
    return interactionMessage("You do not have permission to use these controls.");
  }

  const customId = interaction.data?.custom_id || "";

  if (customId === "board:refresh") {
    await redrawBoard(board, interaction.user?.id);
    return interactionMessage("Board refreshed.");
  }

  if (customId === "board:add-zone") {
    const cards = getDisabledCards(board);
    if (!cards.length) {
      return interactionMessage("No disabled zones remain.");
    }

    return interactionMessage("Choose zone(s) to add.", [
      buildZoneSelect("board:add-zone:select", cards, "Pick one or more zones to add")
    ]);
  }

  if (customId === "board:remove-zone") {
    const cards = getEnabledCards(board);
    if (!cards.length) {
      return interactionMessage("No active zones to remove.");
    }

    return interactionMessage("Choose zone(s) to remove.", [
      buildZoneSelect("board:remove-zone:select", cards, "Pick one or more zones to remove")
    ]);
  }

  if (customId === "board:add-member") {
    const cards = getEnabledCards(board);
    if (!cards.length) {
      return interactionMessage("Enable at least one zone first.");
    }

    return interactionMessage("Choose the zone that should receive new members.", [
      buildZoneSelect("board:add-member:zone", cards, "Which zone should receive members?", 1)
    ]);
  }

  if (customId === "board:remove-member") {
    const cards = getEnabledCards(board);
    if (!cards.length) {
      return interactionMessage("Enable at least one zone first.");
    }

    return interactionMessage("Choose the zone to edit.", [
      buildZoneSelect("board:remove-member:zone", cards, "Which zone should lose members?", 1)
    ]);
  }

  if (customId === "board:reorder") {
    const cards = getEnabledCards(board);
    if (cards.length < 2) {
      return interactionMessage("Enable at least two zones before reordering.");
    }

    return interactionMessage("Choose the timezone you want to move.", [
      buildZoneSelect("board:reorder:select", cards, "Select a timezone to move", 1)
    ]);
  }

  if (customId === "board:reorder:done") {
    return updateInteractionMessage("Reordering finished.");
  }

  if (customId === "board:add-zone:select") {
    const selectedIds = interaction.data?.values || [];
    const updatedBoard = patchBoardCards(board, (cards) => cards.map((card) => (
      selectedIds.includes(card.id) ? { ...card, enabled: true } : card
    )));

    await redrawBoard(updatedBoard, interaction.user?.id);
    return updateInteractionMessage(`Added zone(s): ${labelsFor(board, selectedIds).join(", ")}.`);
  }

  if (customId === "board:remove-zone:select") {
    const selectedIds = interaction.data?.values || [];
    const updatedBoard = patchBoardCards(board, (cards) => cards.map((card) => (
      selectedIds.includes(card.id) ? { ...card, enabled: false } : card
    )));

    await redrawBoard(updatedBoard, interaction.user?.id);
    return updateInteractionMessage(`Removed zone(s): ${labelsFor(board, selectedIds).join(", ")}.`);
  }

  if (customId === "board:reorder:select") {
    const zoneId = interaction.data?.values?.[0];
    const cards = getEnabledCards(board);
    const card = cards.find((current) => current.id === zoneId);
    if (!card) {
      return updateInteractionMessage("That timezone is no longer active.");
    }

    const position = cards.findIndex((current) => current.id === zoneId) + 1;
    return updateInteractionMessage(
      `Move **${card.label}**. It is currently position ${position} of ${cards.length}.`,
      [buildReorderControls(zoneId, cards)]
    );
  }

  if (customId.startsWith("board:reorder:move:")) {
    const parts = customId.split(":");
    const zoneId = parts[3];
    const direction = parts[4];
    const enabledCards = getEnabledCards(board);
    const currentIndex = enabledCards.findIndex((card) => card.id === zoneId);

    if (currentIndex < 0) {
      return updateInteractionMessage("That timezone is no longer active.");
    }

    let targetIndex = currentIndex;
    if (direction === "top") targetIndex = 0;
    if (direction === "up") targetIndex = Math.max(0, currentIndex - 1);
    if (direction === "down") targetIndex = Math.min(enabledCards.length - 1, currentIndex + 1);
    if (direction === "bottom") targetIndex = enabledCards.length - 1;

    const cardLabel = enabledCards[currentIndex].label;
    if (targetIndex === currentIndex) {
      return updateInteractionMessage(
        `**${cardLabel}** is already in that position.`,
        [buildReorderControls(zoneId, enabledCards)]
      );
    }

    const updatedBoard = patchBoardCards(board, (cards) => {
      const active = cards.filter((card) => card.enabled);
      const inactive = cards.filter((card) => !card.enabled);
      const sourceIndex = active.findIndex((card) => card.id === zoneId);
      const [movingCard] = active.splice(sourceIndex, 1);
      active.splice(targetIndex, 0, movingCard);

      return [...active, ...inactive].map((card, index) => ({
        ...card,
        order: index + 1
      }));
    });

    await redrawBoard(updatedBoard, interaction.user?.id);
    const updatedCards = getEnabledCards(updatedBoard);
    const newPosition = updatedCards.findIndex((card) => card.id === zoneId) + 1;

    return updateInteractionMessage(
      `Moved **${cardLabel}** to position ${newPosition} of ${updatedCards.length}.`,
      [buildReorderControls(zoneId, updatedCards)]
    );
  }

  if (customId === "board:add-member:zone") {
    const zoneId = interaction.data?.values?.[0];
    const card = getCard(board, zoneId);
    if (!card) {
      return updateInteractionMessage("That zone no longer exists.");
    }

    return updateInteractionMessage(
      `Choose member(s) to add under **${card.label}**.`,
      [buildUserSelect(`board:add-member:user:${zoneId}`, `Select member(s) for ${card.label}`)]
    );
  }

  if (customId === "board:remove-member:zone") {
    const zoneId = interaction.data?.values?.[0];
    const card = getCard(board, zoneId);
    if (!card) {
      return updateInteractionMessage("That zone no longer exists.");
    }

    return updateInteractionMessage(
      `Choose member(s) to remove from **${card.label}**. Any selected user not currently stored there will simply be ignored.`,
      [buildUserSelect(`board:remove-member:user:${zoneId}`, `Select member(s) to remove from ${card.label}`)]
    );
  }

  if (customId.startsWith("board:add-member:user:")) {
    const zoneId = customId.split(":").pop();
    const selectedIds = interaction.data?.values || [];
    const card = getCard(board, zoneId);
    if (!card) {
      return updateInteractionMessage("That zone no longer exists.");
    }

    const updatedBoard = patchBoardCards(board, (cards) => cards.map((current) => {
      if (current.id !== zoneId) {
        return current;
      }

      return {
        ...current,
        members: Array.from(new Set([...(current.members || []), ...selectedIds]))
      };
    }));

    await redrawBoard(updatedBoard, interaction.user?.id);
    return updateInteractionMessage(`Added ${selectedIds.length} member(s) to ${card.label}.`);
  }

  if (customId.startsWith("board:remove-member:user:")) {
    const zoneId = customId.split(":").pop();
    const selectedIds = interaction.data?.values || [];
    const card = getCard(board, zoneId);
    if (!card) {
      return updateInteractionMessage("That zone no longer exists.");
    }

    let removedCount = 0;
    const updatedBoard = patchBoardCards(board, (cards) => cards.map((current) => {
      if (current.id !== zoneId) {
        return current;
      }

      const before = current.members || [];
      const after = before.filter((id) => !selectedIds.includes(id));
      removedCount = before.length - after.length;
      return {
        ...current,
        members: after
      };
    }));

    await redrawBoard(updatedBoard, interaction.user?.id);
    return updateInteractionMessage(`Removed ${removedCount} matching member(s) from ${card.label}.`);
  }

  return interactionMessage(`Unknown control: ${customId}`);
}

async function handleBoardInit(interaction, existingBoard) {
  const actorId = interaction.user?.id || null;
  const guildId = interaction.guild_id;
  const channelId = interaction.channel_id;

  if (existingBoard?.messageId && existingBoard.channelId === channelId) {
    await redrawBoard(existingBoard, actorId);
    return interactionMessage("Board already existed in this channel. It has been refreshed.");
  }

  const board = existingBoard
    ? {
        ...existingBoard,
        guildId,
        channelId,
        lastUpdatedBy: actorId
      }
    : buildInitialBoard({ guildId, channelId, createdBy: actorId });

  const message = await createMessage(channelId, buildBoardPayload(board));

  await saveBoard({
    ...board,
    messageId: message.id,
    lastRenderedAt: new Date().toISOString(),
    lastUpdatedBy: actorId
  });

  return interactionMessage("Board created in this channel.");
}

async function handleBoardRefresh(interaction, existingBoard) {
  if (!existingBoard?.messageId) {
    return interactionMessage("Run /board-init in the target channel first.");
  }

  await redrawBoard(existingBoard, interaction.user?.id);
  return interactionMessage("Board refreshed.");
}

async function handleAdminRoleAdd(interaction, existingBoard) {
  if (!existingBoard) {
    return interactionMessage("Run /board-init first.");
  }

  const roleId = optionValue(interaction, "role");
  if (!roleId) {
    return interactionMessage("Missing role.");
  }

  const updatedBoard = {
    ...existingBoard,
    adminRoleIds: Array.from(new Set([...(existingBoard.adminRoleIds || []), roleId])),
    lastUpdatedBy: interaction.user?.id || null
  };

  await saveBoard(updatedBoard);
  return interactionMessage(`Added <@&${roleId}> as a board-admin role.`);
}

async function handleAdminRoleRemove(interaction, existingBoard) {
  if (!existingBoard) {
    return interactionMessage("Run /board-init first.");
  }

  const roleId = optionValue(interaction, "role");
  if (!roleId) {
    return interactionMessage("Missing role.");
  }

  const updatedBoard = {
    ...existingBoard,
    adminRoleIds: (existingBoard.adminRoleIds || []).filter((id) => id !== roleId),
    lastUpdatedBy: interaction.user?.id || null
  };

  await saveBoard(updatedBoard);
  return interactionMessage(`Removed <@&${roleId}> from board-admin roles.`);
}

async function redrawBoard(board, actorId) {
  if (!board?.channelId || !board?.messageId) {
    throw new Error("Board is not initialized. Run /board-init first.");
  }

  const now = new Date().toISOString();
  const payload = buildBoardPayload(board, new Date(now));
  await editMessage(board.channelId, board.messageId, payload);

  const updatedBoard = {
    ...board,
    lastRenderedAt: now,
    lastUpdatedBy: actorId || null
  };

  await saveBoard(updatedBoard);
  return updatedBoard;
}

function optionValue(interaction, optionName) {
  const options = interaction.data?.options || [];
  return options.find((option) => option.name === optionName)?.value || null;
}

function labelsFor(board, ids) {
  return ids.map((id) => getCard(board, id)?.label || id);
}

function verifyDiscordRequest(event) {
  const publicKey = process.env.DISCORD_PUBLIC_KEY;
  if (!publicKey) {
    throw new Error("Missing DISCORD_PUBLIC_KEY environment variable.");
  }

  const signature = getHeader(event.headers, "x-signature-ed25519");
  const timestamp = getHeader(event.headers, "x-signature-timestamp");
  const rawBody = event.isBase64Encoded
    ? Buffer.from(event.body || "", "base64").toString("utf8")
    : (event.body || "");

  if (!signature || !timestamp) {
    return false;
  }

  return nacl.sign.detached.verify(
    Buffer.from(timestamp + rawBody),
    Buffer.from(signature, "hex"),
    Buffer.from(publicKey, "hex")
  );
}

function getHeader(headers, targetName) {
  const key = Object.keys(headers || {}).find((header) => header.toLowerCase() === targetName.toLowerCase());
  return key ? headers[key] : null;
}

function interactionMessage(content, components = []) {
  return json({
    type: 4,
    data: {
      flags: 64,
      content,
      components,
      allowed_mentions: {
        parse: []
      }
    }
  });
}

function updateInteractionMessage(content, components = []) {
  return json({
    type: 7,
    data: {
      content,
      components,
      allowed_mentions: {
        parse: []
      }
    }
  });
}

function json(body, statusCode = 200) {
  return {
    statusCode,
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  };
}

function response(statusCode, body) {
  return {
    statusCode,
    body
  };
}
