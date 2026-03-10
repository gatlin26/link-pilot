import { defineCollections, frontmatterSchema } from 'fumadocs-mdx/config';
import { z } from 'zod';

/**
 * Changelog
 *
 * title is required, but description is optional in frontmatter
 */
export const changelog = defineCollections({
  type: 'doc',
  dir: 'content/changelog',
  schema: frontmatterSchema.extend({
    version: z.string(),
    date: z.string().date(),
    published: z.boolean().default(true),
  }),
});

/**
 * Pages, like privacy policy, terms of service, etc.
 *
 * title is required, but description is optional in frontmatter
 */
export const pages = defineCollections({
  type: 'doc',
  dir: 'content/pages',
  schema: frontmatterSchema.extend({
    date: z.string().date(),
    published: z.boolean().default(true),
  }),
});

/**
 * Blog authors
 *
 * description is optional in frontmatter, but we must add it to the schema
 */
export const author = defineCollections({
  type: 'doc',
  dir: 'content/author',
  schema: z.object({
    name: z.string(),
    avatar: z.string(),
    description: z.string().optional(),
  }),
});

/**
 * Blog categories
 *
 * description is optional in frontmatter, but we must add it to the schema
 */
export const category = defineCollections({
  type: 'doc',
  dir: 'content/category',
  schema: z.object({
    name: z.string(),
    description: z.string().optional(),
  }),
});

/**
 * Blog posts
 *
 * title is required, but description is optional in frontmatter
 */
export const blog = defineCollections({
  type: 'doc',
  dir: 'content/blog',
  schema: frontmatterSchema.extend({
    image: z.string(),
    date: z.string().date(),
    published: z.boolean().default(true),
    premium: z.boolean().optional(),
    categories: z.array(z.string()),
    author: z.string(),
  }),
});

/**
 * AI Tools Collection
 *
 * Tools directory for AI image and video tools
 */
export const tools = defineCollections({
  type: 'doc',
  dir: 'content/tools',
  schema: frontmatterSchema.extend({
    id: z.string(),
    name: z.string(),
    title: z.string(),
    description: z.string(),
    category: z.array(z.string()).default([]),
    tags: z.array(z.string()).default([]),
    badge: z.string().optional(),
    published: z.boolean().default(true),
    featured: z.boolean().default(false),
    href: z.string(),
    url: z.string(),
    image: z.string().optional(),
    thumbnailUrl: z.string(),
    collectionTime: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    starRating: z.number().min(1).max(5).default(5),
    order: z.number().optional(),
  }),
});
