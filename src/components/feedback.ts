import { WORKER_URL } from '../api/config';

interface FeedbackData {
  type: string;
  name: string;
  message: string;
}

function isLocalDev(): boolean {
  return window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
}

async function submitFeedback(data: FeedbackData): Promise<void> {
  // In local dev, just log to console (worker isn't running)
  if (isLocalDev()) {
    console.log('[Dev] Feedback submitted:', data);
    return;
  }

  const response = await fetch(`${WORKER_URL}/feedback`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: `HTTP ${response.status}` }));
    throw new Error((errorData as { error?: string }).error || `Failed to submit feedback (${response.status})`);
  }
}

export function initFeedbackForm(): void {
  const form = document.getElementById('feedback-form') as HTMLFormElement;
  const submitBtn = form?.querySelector('.feedback-submit-btn') as HTMLButtonElement;
  if (!form || !submitBtn) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const typeSelect = document.getElementById('feedback-type') as HTMLSelectElement;
    const nameInput = document.getElementById('feedback-name') as HTMLInputElement;
    const messageInput = document.getElementById('feedback-message') as HTMLTextAreaElement;

    const data: FeedbackData = {
      type: typeSelect.value,
      name: nameInput.value.trim(),
      message: messageInput.value.trim(),
    };

    if (!data.message) {
      return;
    }

    // Disable button and show loading state
    submitBtn.disabled = true;
    const originalText = submitBtn.textContent;
    submitBtn.textContent = 'Sending...';

    try {
      await submitFeedback(data);
      form.reset();
      submitBtn.textContent = 'Sent!';
      setTimeout(() => {
        submitBtn.textContent = originalText;
      }, 2000);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      submitBtn.textContent = 'Failed - Try Again';
      setTimeout(() => {
        submitBtn.textContent = originalText;
      }, 3000);
      console.error('Feedback submission failed:', message);
    } finally {
      submitBtn.disabled = false;
    }
  });
}
