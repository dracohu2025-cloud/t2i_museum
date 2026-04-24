import { describe, expect, it } from 'vitest';
import { styleAnalysisResultSchema } from './style-analysis';

describe('styleAnalysisResultSchema', () => {
  it('accepts typed style candidates', () => {
    const parsed = styleAnalysisResultSchema.parse({
      candidates: [
        {
          rawTerm: 'Moebius (Jean Giraud)风格',
          normalizedCandidate: 'Moebius (Jean Giraud)',
          termType: 'artist_style',
          confidence: 0.96,
          shouldBeStyleTag: true,
          shortExplanation: '法式科幻漫画式线稿与色彩控制'
        }
      ]
    });

    expect(parsed.candidates[0].termType).toBe('artist_style');
  });
});
