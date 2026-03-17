/**
 * Mentor G mascot SVG
 * A friendly robot with glasses, blue hard hat with gold star, and circuit-pattern cheeks
 */

export const mascotSvg = `
<svg class="mascot" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
  <!-- Robot Body -->
  <ellipse cx="50" cy="58" rx="35" ry="30" fill="#4a7de8"/>
  <ellipse cx="50" cy="58" rx="32" ry="27" fill="#6b9bef"/>

  <!-- Robot Head -->
  <ellipse cx="50" cy="35" rx="28" ry="24" fill="#4a7de8"/>
  <ellipse cx="50" cy="35" rx="25" ry="21" fill="#6b9bef"/>

  <!-- Hard Hat -->
  <ellipse cx="50" cy="18" rx="26" ry="10" fill="#1a4fc4"/>
  <path d="M24 18 Q50 -2 76 18" fill="#1a4fc4" stroke="#0f2f8a" stroke-width="2"/>
  <rect x="35" y="8" width="30" height="6" rx="3" fill="#1a4fc4"/>

  <!-- Gold Star on Hat -->
  <polygon points="50,6 52,12 58,12 53,16 55,22 50,18 45,22 47,16 42,12 48,12" fill="#f5a623"/>

  <!-- Circuit Pattern on Cheeks -->
  <g stroke="#1a4fc4" stroke-width="1.5" fill="none">
    <!-- Left cheek circuits -->
    <path d="M28 40 L32 40 L32 44"/>
    <circle cx="28" cy="40" r="2" fill="#f5a623"/>
    <path d="M25 48 L30 48"/>
    <circle cx="30" cy="48" r="1.5" fill="#f5a623"/>

    <!-- Right cheek circuits -->
    <path d="M72 40 L68 40 L68 44"/>
    <circle cx="72" cy="40" r="2" fill="#f5a623"/>
    <path d="M75 48 L70 48"/>
    <circle cx="70" cy="48" r="1.5" fill="#f5a623"/>
  </g>

  <!-- Eyes (white part) -->
  <ellipse cx="40" cy="35" rx="8" ry="9" fill="white"/>
  <ellipse cx="60" cy="35" rx="8" ry="9" fill="white"/>

  <!-- Pupils -->
  <circle cx="42" cy="36" r="4" fill="#1a1a2e"/>
  <circle cx="62" cy="36" r="4" fill="#1a1a2e"/>
  <circle cx="43" cy="35" r="1.5" fill="white"/>
  <circle cx="63" cy="35" r="1.5" fill="white"/>

  <!-- Glasses -->
  <g stroke="#1a1a2e" stroke-width="2.5" fill="none">
    <ellipse cx="40" cy="35" rx="11" ry="12"/>
    <ellipse cx="60" cy="35" rx="11" ry="12"/>
    <path d="M51 35 L49 35"/>
    <path d="M29 32 L22 28"/>
    <path d="M71 32 L78 28"/>
  </g>

  <!-- Smile -->
  <path d="M40 50 Q50 58 60 50" stroke="#1a4fc4" stroke-width="3" fill="none" stroke-linecap="round"/>

  <!-- Antenna -->
  <line x1="50" y1="5" x2="50" y2="-2" stroke="#1a4fc4" stroke-width="3"/>
  <circle cx="50" cy="-5" r="4" fill="#f5a623"/>
</svg>
`;

export const mascotSmallSvg = `
<svg width="32" height="32" viewBox="0 0 100 100">
  <ellipse cx="50" cy="35" rx="25" ry="21" fill="#6b9bef"/>
  <ellipse cx="40" cy="35" rx="8" ry="9" fill="white"/>
  <ellipse cx="60" cy="35" rx="8" ry="9" fill="white"/>
  <circle cx="42" cy="36" r="4" fill="#1a1a2e"/>
  <circle cx="62" cy="36" r="4" fill="#1a1a2e"/>
  <g stroke="#1a1a2e" stroke-width="2" fill="none">
    <ellipse cx="40" cy="35" rx="10" ry="11"/>
    <ellipse cx="60" cy="35" rx="10" ry="11"/>
  </g>
</svg>
`;

export const coffeeIconSvg = `
<svg viewBox="0 0 24 24" fill="currentColor">
  <path d="M20 8h-1V6a2 2 0 0 0-2-2H7a2 2 0 0 0-2 2v2H4a2 2 0 0 0-2 2v2a4 4 0 0 0 4 4h1.54A5.98 5.98 0 0 0 12 18.66 5.98 5.98 0 0 0 16.46 16H18a4 4 0 0 0 4-4v-2a2 2 0 0 0-2-2zM6 6h12v8H6V6zm14 6a2 2 0 0 1-2 2h-1V10h3v2z"/>
</svg>
`;

export const uploadIconSvg = `
<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
  <polyline points="14 2 14 8 20 8"/>
  <line x1="12" y1="18" x2="12" y2="12"/>
  <line x1="9" y1="15" x2="15" y2="15"/>
</svg>
`;

export const chevronDownSvg = `
<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
  <polyline points="6 9 12 15 18 9"/>
</svg>
`;
