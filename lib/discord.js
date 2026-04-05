const API_BASE = "https://discord.com/api/v10";

function getBotToken() {
  const token = process.env.DISCORD_BOT_TOKEN;
  if (!token) {
    throw new Error("Missing DISCORD_BOT_TOKEN environment variable.");
  }
  return token;
}

async function discordRequest(method, path, body) {
  const response = await fetch(`${API_BASE}${path}`, {
    method,
    headers: {
      Authorization: `Bot ${getBotToken()}`,
      "Content-Type": "application/json"
    },
    body: body ? JSON.stringify(body) : undefined
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Discord API ${method} ${path} failed: ${response.status} ${text}`);
  }

  if (response.status === 204) {
    return null;
  }

  return response.json();
}

function getApplicationId() {
  const applicationId = process.env.DISCORD_APPLICATION_ID;
  if (!applicationId) {
    throw new Error("Missing DISCORD_APPLICATION_ID environment variable.");
  }
  return applicationId;
}

async function createMessage(channelId, payload) {
  return discordRequest("POST", `/channels/${channelId}/messages`, payload);
}

async function editMessage(channelId, messageId, payload) {
  return discordRequest("PATCH", `/channels/${channelId}/messages/${messageId}`, payload);
}

async function pinMessage(channelId, messageId) {
  return discordRequest("PUT", `/channels/${channelId}/pins/${messageId}`);
}

async function upsertGuildCommand(guildId, commandBody) {
  return discordRequest(
    "POST",
    `/applications/${getApplicationId()}/guilds/${guildId}/commands`,
    commandBody
  );
}

async function upsertGlobalCommand(commandBody) {
  return discordRequest(
    "POST",
    `/applications/${getApplicationId()}/commands`,
    commandBody
  );
}

module.exports = {
  createMessage,
  editMessage,
  pinMessage,
  upsertGuildCommand,
  upsertGlobalCommand,
  getApplicationId
};
