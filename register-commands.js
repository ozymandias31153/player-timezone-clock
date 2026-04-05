// netlify/functions/register-commands.js
const { upsertGuildCommand, upsertGlobalCommand } = require("../../lib/discord");

const commands = [
  {
    name: "board-init",
    description: "Create or move the timezone board into this channel."
  },
  {
    name: "board-refresh",
    description: "Force an immediate board redraw."
  },
  {
    name: "board-admin-role-add",
    description: "Allow one extra role to use the board controls.",
    options: [
      {
        type: 8,
        name: "role",
        description: "Role to allow",
        required: true
      }
    ]
  },
  {
    name: "board-admin-role-remove",
    description: "Remove one extra board-admin role.",
    options: [
      {
        type: 8,
        name: "role",
        description: "Role to remove",
        required: true
      }
    ]
  }
];

exports.handler = async (event) => {
  if (event.httpMethod !== "GET") {
    return {
      statusCode: 405,
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ok: false, error: "Method not allowed" })
    };
  }

  try {
    const guildId = process.env.DISCORD_GUILD_ID;
    const registered = [];

    for (const command of commands) {
      if (guildId) {
        await upsertGuildCommand(guildId, command);
        registered.push({ name: command.name, scope: "guild" });
      } else {
        await upsertGlobalCommand(command);
        registered.push({ name: command.name, scope: "global" });
      }
    }

    return {
      statusCode: 200,
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        ok: true,
        message: "Commands registered successfully.",
        registered
      })
    };
  } catch (error) {
    return {
      statusCode: 500,
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        ok: false,
        error: error.message || "Unknown error"
      })
    };
  }
};