type LinkableDay = { id: string; supplementTo?: string };

// Invalid or stale links remain visible as ordinary Days, never hidden content.
export function groupDays<T extends LinkableDay>(days: T[]) {
  const byId = new Map(days.map(day => [day.id, day]));
  const parentOf = (day: T) => {
    const parent = day.supplementTo ? byId.get(day.supplementTo) : undefined;
    return parent && parent.id !== day.id && !parent.supplementTo ? parent.id : undefined;
  };
  return days.filter(day => !parentOf(day)).map(day => ({
    day,
    supplements: days.filter(candidate => parentOf(candidate) === day.id),
  }));
}

export function supplementCandidates<T extends LinkableDay>(days: T[], dayId: string) {
  const groups = groupDays(days);
  if (!days.some(day => day.id === dayId) || groups.some(group => group.day.id === dayId && group.supplements.length)) return [];
  return groups.map(group => group.day).filter(day => day.id !== dayId && !day.supplementTo);
}

export function detachDay<T extends LinkableDay>(day: T): T {
  const result = { ...day };
  delete result.supplementTo;
  return result;
}

export function removeDayLinks<T extends LinkableDay>(days: T[], dayId: string): T[] {
  return days.filter(day => day.id !== dayId).map(day => day.supplementTo === dayId ? detachDay(day) : day);
}
