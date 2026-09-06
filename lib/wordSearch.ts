export function matchesWordSearch(word: { word: string; meanings?: { items?: string[] }[] }, query: string) {
  const normalized = query.normalize("NFKC").trim().toLocaleLowerCase();
  if (!normalized) return true;
  return [word.word, ...(word.meanings ?? []).flatMap(group => group.items ?? [])]
    .some(text => text.normalize("NFKC").toLocaleLowerCase().includes(normalized));
}
