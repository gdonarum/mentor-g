/**
 * Mentor G - Settings Modal Component
 * Copyright (c) 2026 Gregory Donarum
 * Licensed under MIT License with Commons Clause
 */

import { getApiKey, setApiKey, hasApiKey, useWorkerMode } from '../api/config';

export function createSettingsButton(): string {
  return `
    <button class="settings-btn" id="settings-btn" title="Settings">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="12" cy="12" r="3"/>
        <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/>
      </svg>
    </button>
  `;
}

export function createSettingsModal(): string {
  return `
    <div class="settings-modal" id="settings-modal">
      <div class="settings-content">
        <div class="settings-header">
          <h3>Settings</h3>
          <button class="settings-close" id="settings-close">&times;</button>
        </div>
        <div class="settings-body">
          <label for="api-key-input">Anthropic API Key</label>
          <p class="settings-hint">Your key is stored locally in your browser and never sent to any server except Anthropic's API.</p>
          <div class="api-key-input-wrapper">
            <input type="password" id="api-key-input" placeholder="sk-ant-..." />
            <button class="toggle-visibility" id="toggle-api-key" title="Show/hide key">
              <svg class="eye-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                <circle cx="12" cy="12" r="3"/>
              </svg>
            </button>
          </div>
          <button class="save-api-key-btn" id="save-api-key">Save API Key</button>
          <p class="api-key-status" id="api-key-status"></p>
        </div>
      </div>
    </div>
  `;
}

export function initSettings(): void {
  const settingsBtn = document.getElementById('settings-btn');
  const settingsModal = document.getElementById('settings-modal');

  // Hide settings in worker mode (API key is handled server-side)
  if (useWorkerMode()) {
    if (settingsBtn) settingsBtn.style.display = 'none';
    if (settingsModal) settingsModal.style.display = 'none';
    return;
  }

  if (!settingsBtn || !settingsModal) return;

  const settingsClose = document.getElementById('settings-close')!;
  const apiKeyInput = document.getElementById('api-key-input') as HTMLInputElement;
  const toggleApiKey = document.getElementById('toggle-api-key')!;
  const saveApiKeyBtn = document.getElementById('save-api-key')!;
  const apiKeyStatus = document.getElementById('api-key-status')!;

  // Load existing key
  const existingKey = getApiKey();
  if (existingKey) {
    apiKeyInput.value = existingKey;
    updateStatus(true);
  }

  // Open modal
  settingsBtn.addEventListener('click', () => {
    settingsModal.classList.add('visible');
  });

  // Close modal
  settingsClose.addEventListener('click', () => {
    settingsModal.classList.remove('visible');
  });

  // Close on backdrop click
  settingsModal.addEventListener('click', (e) => {
    if (e.target === settingsModal) {
      settingsModal.classList.remove('visible');
    }
  });

  // Toggle visibility
  toggleApiKey.addEventListener('click', () => {
    const isPassword = apiKeyInput.type === 'password';
    apiKeyInput.type = isPassword ? 'text' : 'password';
  });

  // Save key
  saveApiKeyBtn.addEventListener('click', () => {
    const key = apiKeyInput.value.trim();
    if (key) {
      setApiKey(key);
      updateStatus(true);
      settingsModal.classList.remove('visible');
    }
  });

  function updateStatus(hasKey: boolean): void {
    if (hasKey) {
      apiKeyStatus.textContent = '✓ API key configured';
      apiKeyStatus.className = 'api-key-status success';
      settingsBtn!.classList.add('configured');
    } else {
      apiKeyStatus.textContent = '';
      apiKeyStatus.className = 'api-key-status';
      settingsBtn!.classList.remove('configured');
    }
  }

  // Update button indicator on load
  if (hasApiKey()) {
    settingsBtn!.classList.add('configured');
  }
}
