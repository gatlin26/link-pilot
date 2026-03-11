/**
 * Submission Handler for Content Script
 * Handles form filling and submission detection
 */

import type { FillData } from '../form-handlers/auto-fill-service';
import { formDetector, type FormDetectionResult } from '../form-handlers/form-detector';
import { autoFillService, type FillResult } from '../form-handlers/auto-fill-service';

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
    }
  });
}

/**
 * Fill form and wait for user submission
 */
async function handleFillAndWait(data: { 
  fillData: FillData; 
  comment: string;
  taskId?: string;
}): Promise<{ success: boolean; error?: string; taskId?: string }> {
  try {
    // 1. Detect form
    const detectionResult: FormDetectionResult | null = await detectForm();

    if (!detectionResult) {
      return { success: false, error: 'No comment form detected', taskId: data.taskId };
    }

    // 2. Fill the form (but not submit)
    const fillResult: FillResult = await autoFillService.fill(
      detectionResult.fields,
      {
        name: data.fillData.name,
        email: data.fillData.email,
        website: data.fillData.website,
        comment: data.comment,
      },
      false // Don't auto-submit
    );

    if (!fillResult.success) {
      return { success: false, error: fillResult.error || 'Failed to fill form', taskId: data.taskId };
    }

    // 3. Setup observer to detect submission
    const observer = setupSubmissionObserver(detectionResult.form, data.taskId);

    // 4. Return success - user needs to click submit
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
  for (const field of commentFields) {
    if ((field as HTMLTextAreaElement).value === '') {
      // Field is empty, might have been submitted
      // Check if there's a new comment in the list
      const commentLists = document.querySelectorAll('.comment-list, .comments-list, #comments');
      for (const list of commentLists) {
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
