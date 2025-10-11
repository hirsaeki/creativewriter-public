import { calculateDesiredSummaryWordCount } from './story-outline-overview.utils';

describe('calculateDesiredSummaryWordCount', () => {
  const makeSceneText = (words: number): string => Array.from({ length: words }, () => 'word').join(' ');

  it('keeps the base 120-word target for scenes up to 5000 words', () => {
    const sceneText = makeSceneText(5000);
    expect(calculateDesiredSummaryWordCount(sceneText)).toBe(120);
  });

  it('adds 20 words per additional 1000 scene words beyond 5000', () => {
    const sceneText = makeSceneText(10000);
    expect(calculateDesiredSummaryWordCount(sceneText)).toBe(220);
  });

  it('continues scaling for very long scenes', () => {
    const sceneText = makeSceneText(14000);
    expect(calculateDesiredSummaryWordCount(sceneText)).toBe(300);
  });

  it('respects a configured base word count while still scaling', () => {
    const sceneText = makeSceneText(8000);
    expect(calculateDesiredSummaryWordCount(sceneText, 200)).toBe(240);
  });

  it('handles string-based overrides from forms', () => {
    const sceneText = makeSceneText(9000);
    expect(calculateDesiredSummaryWordCount(sceneText, '150' as unknown as number)).toBe(230);
  });
});
