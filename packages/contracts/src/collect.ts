import { z } from 'zod';

import { styleTermTypeSchema } from './style-analysis';

export const approvedStyleTagSchema = z.object({
  name: z.string().min(1),
  termType: styleTermTypeSchema.optional().default('aesthetic_style'),
  shortExplanation: z.string().optional().default('用户确认的风格关键词。')
});

export const collectWorkPayloadSchema = z.object({
  sourceSite: z.literal('jimeng'),
  sourceWorkId: z.string().min(1),
  sourceUrl: z.string().url(),
  promptRaw: z.string().min(1),
  imageSourceUrl: z.string().url(),
  authorName: z.string().optional().default(''),
  publishedAt: z.string().optional().default(''),
  modelLabel: z.string().optional().default(''),
  aspectRatio: z.string().optional().default(''),
  approvedStyles: z.array(approvedStyleTagSchema).optional().default([])
});

export type ApprovedStyleTag = z.infer<typeof approvedStyleTagSchema>;
export type ParsedCollectWorkPayload = z.infer<typeof collectWorkPayloadSchema>;
export type CollectWorkPayload = Omit<ParsedCollectWorkPayload, 'approvedStyles'> & {
  approvedStyles?: ApprovedStyleTag[];
};
