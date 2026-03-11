'use server';

import { getDb } from '@/db';
import { backlinks } from '@/db/schema';
import { actionClient } from '@/lib/safe-action';
import { eq, inArray } from 'drizzle-orm';
import { z } from 'zod';
import { LinkAvailabilityQueue, createQueue } from '@link-pilot/link-availability-checker';
import { LinkTypeClassifier, createClassifier, LinkType } from '@link-pilot/link-type-classifier';

/**
 * Input schema for batch check links
 */
const batchCheckLinksSchema = z.object({
  linkIds: z.array(z.string()).min(1).max(100),
  checkAvailability: z.boolean().default(true),
  checkType: z.boolean().default(true),
});

/**
 * Process URLs in batches
 */
async function processInBatches<T, R>(
  items: T[],
  batchSize: number,
  processor: (item: T) => Promise<R>
): Promise<R[]> {
  const results: R[] = [];
  const totalBatches = Math.ceil(items.length / batchSize);

  for (let i = 0; i < totalBatches; i++) {
    const batch = items.slice(i * batchSize, (i + 1) * batchSize);
    const batchResults = await Promise.all(batch.map(processor));
    results.push(...batchResults);
  }

  return results;
}

/**
 * Batch check link availability and type
 */
export const batchCheckLinksAction = actionClient
  .schema(batchCheckLinksSchema)
  .action(async ({ parsedInput }) => {
    try {
      const db = await getDb();
      const { linkIds, checkAvailability, checkType } = parsedInput;

      // Fetch links from database
      const links = await db
        .select({
          id: backlinks.id,
          url: backlinks.url,
          isAvailable: backlinks.isAvailable,
          availableAt: backlinks.availableAt,
          availabilityError: backlinks.availabilityError,
          linkType: backlinks.linkType,
          linkTypeConfidence: backlinks.linkTypeConfidence,
        })
        .from(backlinks)
        .where(inArray(backlinks.id, linkIds));

      if (links.length === 0) {
        return {
          success: false,
          error: 'No links found',
        };
      }

      const urls = links.map((l) => l.url);
      const results: {
        id: string;
        url: string;
        isAvailable?: boolean;
        availableAt?: string;
        availabilityError?: string;
        linkType?: LinkType;
        linkTypeConfidence?: number;
      }[] = [];

      // Check availability if requested
      if (checkAvailability) {
        const queue = createQueue({
          timeout: 5000,
          maxRetries: 3,
          maxConcurrency: 5,
        });

        queue.addUrls(urls);
        const checkResults = await queue.process();

        // Map results to links
        for (const link of links) {
          const result = checkResults.results.find((r) => r.url === link.url);
          if (result) {
            results.push({
              id: link.id,
              url: link.url,
              isAvailable: result.status === 'alive',
              availableAt: result.status !== 'unknown' ? result.checkedAt : undefined,
              availabilityError: result.error,
            });
          }
        }

        // Update database
        await Promise.all(
          results.map((r) =>
            db
              .update(backlinks)
              .set({
                isAvailable: r.isAvailable,
                availableAt: r.availableAt ? new Date(r.availableAt) : null,
                availabilityError: r.availabilityError,
              })
              .where(eq(backlinks.id, r.id))
          )
        );
      }

      // Check link type if requested
      if (checkType) {
        const classifier = createClassifier();

        for (const link of links) {
          // Skip if we don't have a result from availability check or if it's dead
          const existingResult = results.find((r) => r.id === link.id);
          if (checkAvailability && existingResult && !existingResult.isAvailable) {
            continue;
          }

          const classification = await classifier.classify(link.url);
          results.push({
            id: link.id,
            url: link.url,
            linkType: classification.linkType,
            linkTypeConfidence: Math.round(classification.confidence * 100),
          });

          // Update database
          await db
            .update(backlinks)
            .set({
              linkType: classification.linkType,
              linkTypeConfidence: Math.round(classification.confidence * 100),
            })
            .where(eq(backlinks.id, link.id));
        }
      }

      return {
        success: true,
        data: {
          processed: results.length,
          results,
        },
      };
    } catch (error) {
      console.error('Batch check links error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to check links',
      };
    }
  });

/**
 * Input schema for checking a single link
 */
const checkSingleLinkSchema = z.object({
  linkId: z.string(),
  checkAvailability: z.boolean().default(true),
  checkType: z.boolean().default(true),
});

/**
 * Check a single link's availability and type
 */
export const checkSingleLinkAction = actionClient
  .schema(checkSingleLinkSchema)
  .action(async ({ parsedInput }) => {
    try {
      const db = await getDb();
      const { linkId, checkAvailability, checkType } = parsedInput;

      // Fetch link from database
      const [link] = await db
        .select({
          id: backlinks.id,
          url: backlinks.url,
        })
        .from(backlinks)
        .where(eq(backlinks.id, linkId))
        .limit(1);

      if (!link) {
        return {
          success: false,
          error: 'Link not found',
        };
      }

      const result: {
        id: string;
        url: string;
        isAvailable?: boolean;
        availableAt?: string;
        availabilityError?: string;
        linkType?: LinkType;
        linkTypeConfidence?: number;
      } = {
        id: link.id,
        url: link.url,
      };

      // Check availability
      if (checkAvailability) {
        const checker = createChecker({ timeout: 5000, maxRetries: 2 });
        const availabilityResult = await checker.check(link.url);

        result.isAvailable = availabilityResult.status === 'alive';
        result.availableAt = availabilityResult.status !== 'unknown' ? availabilityResult.checkedAt : undefined;
        result.availabilityError = availabilityResult.error;

        await db
          .update(backlinks)
          .set({
            isAvailable: result.isAvailable,
            availableAt: result.availableAt ? new Date(result.availableAt) : null,
            availabilityError: result.availabilityError,
          })
          .where(eq(backlinks.id, linkId));
      }

      // Check link type
      if (checkType) {
        const classifier = createClassifier();
        const classification = await classifier.classify(link.url);

        result.linkType = classification.linkType;
        result.linkTypeConfidence = Math.round(classification.confidence * 100);

        await db
          .update(backlinks)
          .set({
            linkType: classification.linkType,
            linkTypeConfidence: result.linkTypeConfidence,
          })
          .where(eq(backlinks.id, linkId));
      }

      return {
        success: true,
        data: result,
      };
    } catch (error) {
      console.error('Check single link error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to check link',
      };
    }
  });
