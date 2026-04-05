require("dotenv").config();

const { upsertGuildCommand, upsertGlobalCommand } = require("../lib/discord");

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

async function main() {
  const guildId = process.env.DISCORD_GUILD_ID;

  for (const command of commands) {
    if (guildId) {
      await upsertGuildCommand(guildId, command);
      console.log(`Registered guild command: ${command.name}`);
    } else {
      await upsertGlobalCommand(command);
      console.log(`Registered global command: ${command.name}`);
    }
  }

  console.log("Done.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
