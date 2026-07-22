import { defineCollection, z } from 'astro:content';

const blog = defineCollection({
  type: 'content',
  schema: z.object({
    title: z.string(),
    date: z.date(),
    description: z.string(),
    tags: z.array(z.string()),
    category: z.string(),
    targetApp: z.enum(['torehan', 'urehan', 'both']),
  }),
});

export const collections = { blog };
