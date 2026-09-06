export type DailyCandidate = { id: string; memorized?: boolean; importanceStars?: number };
export function selectDailyWords(words: DailyCandidate[], lastShown: Record<string, string>, limit = 30, random = Math.random): string[] {
  const unique = [...new Map(words.map(word => [word.id, word])).values()];
  const ranked = unique.map(word => ({ word, random: random() })).sort((a,b) =>
    (lastShown[a.word.id] || '').localeCompare(lastShown[b.word.id] || '') || a.random-b.random);
  const chosen = new Set<string>();
  const take = (predicate: (word: DailyCandidate) => boolean, amount: number) => {
    let taken = 0;
    for (const {word} of ranked) if (!chosen.has(word.id) && predicate(word) && taken < amount && chosen.size < limit) {chosen.add(word.id);taken++;}
  };
  take(word => (word.importanceStars || 0) > 0, Math.min(6, Math.ceil(limit / 5)));
  take(word => !word.memorized, limit - chosen.size);
  take(() => true, limit - chosen.size);
  const result=[...chosen];
  for(let i=result.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[result[i],result[j]]=[result[j],result[i]];}
  return result;
}
export function localDay(date = new Date()) { return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`; }
