export const formatTime = (milliseconds) => {
  const totalSeconds = Math.floor(milliseconds / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  const ms = String(milliseconds % 1000).padStart(3, '0').slice(0, 2);

  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}.${ms}`;
};

export const calculateTimeStats = (times) => {
  if (!times || times.length === 0) return null;

  const sortedTimes = [...times].sort((a, b) => a - b);
  return {
    best: sortedTimes[0],
    average: Math.round(times.reduce((a, b) => a + b, 0) / times.length),
    median: sortedTimes[Math.floor(sortedTimes.length / 2)]
  };
};

export const formatTimeCompact = (milliseconds) => {
  const totalSeconds = Math.floor(milliseconds / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return minutes > 0
    ? `${minutes}m ${seconds}s`
    : `${seconds}s`;
};