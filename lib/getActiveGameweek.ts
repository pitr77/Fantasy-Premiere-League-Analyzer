type FplEvent = {
  id: number;
  deadline_time: string; // ISO
};

export function getActiveGameweekId(events: FplEvent[], now = new Date()): number {
  if (!events?.length) return 1;

  const sorted = [...events].sort((a, b) => a.id - b.id);

  // first event whose deadline is in the future = "upcoming"
  const upcomingIndex = sorted.findIndex(e => new Date(e.deadline_time).getTime() > now.getTime());

  // If we're before the next deadline -> we are "in" previous GW (if exists), otherwise it's preseason -> upcoming
  if (upcomingIndex === -1) return sorted[sorted.length - 1].id; // season end
  if (upcomingIndex === 0) return sorted[0].id; // before GW1 deadline

  return sorted[upcomingIndex - 1].id; // after GW X deadline, before GW X+1 deadline => active = X
}
