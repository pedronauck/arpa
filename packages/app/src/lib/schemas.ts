import { z } from 'zod';

export const chatInputSchema = z.object({
  message: z.string()
    .min(1, 'Message cannot be empty')
    .max(4000, 'Message must be less than 4000 characters')
    .refine(
      (val) => val.trim().length > 0,
      'Message cannot be only whitespace'
    ),
});

export type ChatInputData = z.infer<typeof chatInputSchema>;
