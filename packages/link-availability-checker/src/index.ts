/**
 * Link Availability Checker
 * Checks if URLs are alive using HTTP HEAD/GET requests
 */

export { LinkAvailabilityChecker, createChecker } from './checker';
export { LinkAvailabilityQueue, createQueue } from './queue';
export type {
  AvailabilityResult,
  AvailabilityStatus,
  BatchCheckResult,
  CheckerConfig,
  QueueItem,
} from './types';
