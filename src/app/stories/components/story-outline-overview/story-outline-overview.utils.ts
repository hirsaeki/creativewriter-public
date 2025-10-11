export function calculateDesiredSummaryWordCount(sceneText: string, configuredWordCount?: number | null): number {
  const wordCount = countWords(sceneText);
  const baseWordCount = 120;
  const baseWordThreshold = 5000;

  const extraWordCount = wordCount > baseWordThreshold
    ? Math.floor((wordCount - baseWordThreshold) / 1000) * 20
    : 0;

  const dynamicWordCount = baseWordCount + extraWordCount;
  const override = configuredWordCount && configuredWordCount > 0 ? configuredWordCount : null;
  const target = override ?? dynamicWordCount;

  return Math.max(20, Math.min(1000, target));
}

function countWords(text: string): number {
  if (!text) return 0;
  return text.trim().split(/\s+/).filter(Boolean).length;
}
