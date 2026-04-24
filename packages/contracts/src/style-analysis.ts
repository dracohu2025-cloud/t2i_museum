import { z } from 'zod';

export const styleTermTypeSchema = z.enum([
  'artist_style',
  'movement_style',
  'aesthetic_style',
  'medium_rendering',
  'quality_modifier',
  'subject_content',
  'mood_atmosphere'
]);

export const styleAnalysisCandidateSchema = z.object({
  rawTerm: z.string().min(1),
  normalizedCandidate: z.string().min(1),
  termType: styleTermTypeSchema,
  confidence: z.number().min(0).max(1),
  shouldBeStyleTag: z.boolean(),
  shortExplanation: z.string().min(1)
});

export const styleAnalysisResultSchema = z.object({
  candidates: z.array(styleAnalysisCandidateSchema)
});

export type StyleTermType = z.infer<typeof styleTermTypeSchema>;
export type StyleAnalysisCandidate = z.infer<typeof styleAnalysisCandidateSchema>;
export type StyleAnalysisResult = z.infer<typeof styleAnalysisResultSchema>;
