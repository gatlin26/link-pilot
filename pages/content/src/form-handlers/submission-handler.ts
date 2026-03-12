/**
 * Submission Handler for Content Script
 * Handles form filling and submission detection
 */

import type { FillData, FillResult, WebsiteProfile } from '@extension/shared';
import { formDetector, type FormDetectionResult } from '../form-handlers/form-detector';
import { autoFillService } from '../form-handlers/auto-fill-service';
import { buildCommentCandidates } from '../../popup/src/utils/comment-generator';

/**
 * Setup message listener for submission commands
 */
export function setupSubmissionHandler(): void {
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    switch (message.type) {
      case 'FILL_AND_WAIT':
        handleFillAndWait(message.data)
          .then(sendResponse)
          .catch(error => sendResponse({ success: false, error: error.message }));
        return true; // Keep message channel open for async response

      case 'CONFIRM_SUBMISSION':
        handleConfirmSubmission(message.data)
          .then(sendResponse)
          .catch(error => sendResponse({ success: false, error: error.message }));
        return true;

      case 'GET_SUBMISSION_STATUS':
        handleGetStatus()
          .then(sendResponse);
        return true;

      default:
        return false;
    }
  });
}

/**
 * Fill form and wait for user submission
 */
async function handleFillAndWait(data: {
  backlinkId: string;
  websiteProfileId: string;
  context: {
    backlinkNote?: string;
    backlinkKeywords?: string[];
  };
  taskId?: string;
}): Promise<{ success: boolean; error?: string; taskId?: string }> {
  try {
    // 1. Get WebsiteProfile via chrome.runtime.sendMessage
    const profileResponse = await chrome.runtime.sendMessage({
      type: 'WEBSITE_PROFILE_STORAGE_GET_BY_ID',
      id: data.websiteProfileId,
    });

    if (!profileResponse.success || !profileResponse.data) {
      return { success: false, error: 'Failed to get website profile', taskId: data.taskId };
    }

    const profile: WebsiteProfile = profileResponse.data;

    // 2. Get page state (reusing existing detectForm)
    const detectionResult: FormDetectionResult | null = await detectForm();

    if (!detectionResult) {
      return { success: false, error: 'No comment form detected', taskId: data.taskId };
    }

    // Build page state for comment generation
    const pageState = {
      seo: {
        title: document.title || '',
        description: '',
        h1: document.querySelector('h1')?.textContent || '',
        language: document.documentElement.lang || 'zh',
        url: window.location.href,
      },
      form_detected: true,
      form_confidence: detectionResult.confidence || 0,
      field_types: detectionResult.fields.map(f => f.type),
      backlink_in_current_group: false,
      selected_website_link_present: false,
    };

    // Build current backlink for comment generation
    const currentBacklink = {
      id: data.backlinkId,
      group_id: '',
      url: '',
      domain: '',
      note: data.context.backlinkNote,
      keywords: data.context.backlinkKeywords || [],
      flagged: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    // 3. Call buildCommentCandidates to generate comments
    const comments = buildCommentCandidates(profile, pageState, currentBacklink);

    if (comments.length === 0) {
      return { success: false, error: 'Failed to generate comment candidates', taskId: data.taskId };
    }

    // 4. Build FillData
    const fillData: FillData = {
      name: profile.author_name || profile.name,
      email: profile.author_email || profile.email,
      website: profile.url,
      comment: comments[0], // Use first candidate
    };

    // 5. Fill the form (but not submit)
    const fillResult: FillResult = await autoFillService.fill(
      detectionResult.fields,
      fillData,
      false // Don't auto-submit
    );

    if (!fillResult.success) {
      return { success: false, error: fillResult.error || 'Failed to fill form', taskId: data.taskId };
    }

    // 6. Setup observer to detect submission
    if (!detectionResult.formElement) {
      return { success: false, error: 'Could not find form element', taskId: data.taskId };
    }
    const observer = setupSubmissionObserver(detectionResult.formElement, data.taskId);

    // 7. Return success - user needs to click submit
    return { success: true, taskId: data.taskId };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      taskId: data.taskId
    };
  }
}

/**
 * Detect comment form on page
 */
async function detectForm(): Promise<FormDetectionResult | null> {
  // Wait for page to be ready
  await waitForPageReady();

  // Run form detection
  const result = await formDetector.detect();
  return result.detected ? result : null;
}

/**
 * Wait for page to be ready
 */
function waitForPageReady(): Promise<void> {
  return new Promise((resolve) => {
    if (document.readyState === 'complete') {
      // Give a small delay for dynamic content
      setTimeout(resolve, 1000);
    } else {
      window.addEventListener('load', () => {
        setTimeout(resolve, 1000);
      });
    }
  });
}

/**
 * Setup observer to detect form submission
 */
function setupSubmissionObserver(form: HTMLFormElement, taskId?: string): MutationObserver {
  const observer = new MutationObserver((mutations, obs) => {
    // Check if form was submitted or success message appeared
    if (checkSubmissionSuccess()) {
      obs.disconnect();
      
      // Notify background script
      chrome.runtime.sendMessage({
        type: 'SUBMISSION_CONFIRMED',
        data: {
          taskId,
          success: true,
          timestamp: new Date().toISOString(),
        },
      });
    }
  });

  // Observe the form and document body
  observer.observe(form, {
    childList: true,
    attributes: true,
    subtree: true,
  });

  // Also observe for navigation or success messages
  observer.observe(document.body, {
    childList: true,
    subtree: true,
  });

  // Set a timeout (2 minutes)
  setTimeout(() => {
    observer.disconnect();
  }, 120000);

  return observer;
}

/**
 * Check if submission was successful
 */
function checkSubmissionSuccess(): boolean {
  // 1. Check for success message elements
  const successSelectors = [
    '.success-message',
    '.thank-you-message',
    '.comment-success',
    '[class*="success"]',
    '[class*="thanks"]',
    '#comment-success',
    '.alert-success',
    '.notification-success',
    // Common WordPress success messages
    '.comment-form-moved',
    '.comment-registration-required',
  ];

  for (const selector of successSelectors) {
    const element = document.querySelector(selector);
    if (element && window.getComputedStyle(element).display !== 'none') {
      const text = element.textContent?.toLowerCase() || '';
      if (text.includes('success') || text.includes('thank') || text.includes('approved')) {
        return true;
      }
    }
  }

  // 2. Check if the comment textarea is now empty (comment was submitted)
  const commentFields = document.querySelectorAll('textarea[name*="comment"], textarea[id*="comment"]');
  for (const field of Array.from(commentFields)) {
    if ((field as HTMLTextAreaElement).value === '') {
      // Field is empty, might have been submitted
      // Check if there's a new comment in the list
      const commentLists = document.querySelectorAll('.comment-list, .comments-list, #comments');
      for (const list of Array.from(commentLists)) {
        if (list.children.length > 0) {
          return true;
        }
      }
    }
  }

  // 3. Check for error messages (to detect failure)
  const errorSelectors = [
    '.error-message',
    '.alert-danger',
    '.notification-error',
    '[class*="error"]',
  ];

  for (const selector of errorSelectors) {
    const element = document.querySelector(selector);
    if (element && window.getComputedStyle(element).display !== 'none') {
      // There's an error, but we should still check if something was submitted
      // Some sites show errors but still submit
    }
  }

  // 4. Check URL for success indicators
  const url = window.location.href;
  if (url.includes('comment') || url.includes('success') || url.includes('thank')) {
    return true;
  }

  return false;
}

/**
 * Handle manual confirmation from user
 */
async function handleConfirmSubmission(data: { taskId: string; success: boolean; error?: string }): Promise<{ success: boolean }> {
  // Notify background script
  chrome.runtime.sendMessage({
    type: 'SUBMISSION_CONFIRMED',
    data: {
      taskId: data.taskId,
      success: data.success,
      error: data.error,
      timestamp: new Date().toISOString(),
    },
  });

  return { success: true };
}

/**
 * Get current submission status
 */
async function handleGetStatus(): Promise<{
  hasForm: boolean;
  formDetected: boolean;
  url: string;
}> {
  const detectionResult = await detectForm();
  
  return {
    hasForm: detectionResult !== null,
    formDetected: detectionResult !== null,
    url: window.location.href,
  };
}
