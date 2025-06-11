
export const generateInviteLink = (puzzleId) => {
  const baseUrl = window.location.origin;
  const inviteCode = encodeURIComponent(puzzleId);
  return `${baseUrl}/join/${inviteCode}`;
};

export const extractPuzzleId = (inviteLink) => {
  try {
    const url = new URL(inviteLink);
    const pathParts = url.pathname.split('/');
    const inviteCode = pathParts[pathParts.length - 1];
    return decodeURIComponent(inviteCode);
  } catch (err) {
    console.error('Invalid invite link:', err);
    return null;
  }
};

export const isValidInviteLink = (inviteLink) => {
  try {
    const url = new URL(inviteLink);
    return url.pathname.startsWith('/join/') && extractPuzzleId(inviteLink) !== null;
  } catch {
    return false;
  }
};