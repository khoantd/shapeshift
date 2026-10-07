/**
 * Ids present in `nextIds` but not in `previousIds`.
 * Returns [] when previous was empty so the initial graph paint is not highlighted.
 */
export function newlyAppearedNodeIds(
  previousIds: ReadonlySet<string>,
  nextIds: Iterable<string>,
): string[] {
  if (previousIds.size === 0) return [];
  const appeared: string[] = [];
  for (const id of nextIds) {
    if (!previousIds.has(id)) appeared.push(id);
  }
  return appeared;
}
