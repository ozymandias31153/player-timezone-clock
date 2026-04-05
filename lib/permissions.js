const ADMINISTRATOR = 1n << 3n;
const MANAGE_CHANNELS = 1n << 4n;
const MANAGE_GUILD = 1n << 5n;

function hasBit(permissionsValue, bit) {
  if (!permissionsValue) {
    return false;
  }

  try {
    return (BigInt(permissionsValue) & bit) === bit;
  } catch {
    return false;
  }
}

function hasBoardAccess(interaction, board = {}) {
  const ownerId = process.env.DISCORD_OWNER_ID;
  const member = interaction.member || {};
  const memberRoles = Array.isArray(member.roles) ? member.roles : [];
  const adminRoleIds = Array.isArray(board.adminRoleIds) ? board.adminRoleIds : [];

  if (interaction.user?.id && ownerId && interaction.user.id === ownerId) {
    return true;
  }

  if (hasBit(member.permissions, ADMINISTRATOR)) {
    return true;
  }

  if (hasBit(member.permissions, MANAGE_GUILD) || hasBit(member.permissions, MANAGE_CHANNELS)) {
    return true;
  }

  return adminRoleIds.some((roleId) => memberRoles.includes(roleId));
}

module.exports = {
  hasBoardAccess
};
