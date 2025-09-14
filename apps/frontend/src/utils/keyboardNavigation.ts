/**
 * Keyboard navigation utilities for accessibility
 */

export const KEYBOARD_KEYS = {
  ENTER: 'Enter',
  SPACE: ' ',
  ESCAPE: 'Escape',
  TAB: 'Tab',
  ARROW_UP: 'ArrowUp',
  ARROW_DOWN: 'ArrowDown',
  ARROW_LEFT: 'ArrowLeft',
  ARROW_RIGHT: 'ArrowRight',
  HOME: 'Home',
  END: 'End',
  PAGE_UP: 'PageUp',
  PAGE_DOWN: 'PageDown',
} as const;

export type KeyboardKey = typeof KEYBOARD_KEYS[keyof typeof KEYBOARD_KEYS];

/**
 * Check if an element is focusable
 */
export const isFocusable = (element: Element): boolean => {
  const focusableSelectors = [
    'a[href]',
    'button:not([disabled])',
    'input:not([disabled])',
    'select:not([disabled])',
    'textarea:not([disabled])',
    '[tabindex]:not([tabindex="-1"])',
    '[contenteditable="true"]',
  ];

  return focusableSelectors.some(selector => element.matches(selector));
};

/**
 * Get all focusable elements within a container
 */
export const getFocusableElements = (container: Element): Element[] => {
  const focusableSelectors = [
    'a[href]',
    'button:not([disabled])',
    'input:not([disabled])',
    'select:not([disabled])',
    'textarea:not([disabled])',
    '[tabindex]:not([tabindex="-1"])',
    '[contenteditable="true"]',
  ].join(', ');

  return Array.from(container.querySelectorAll(focusableSelectors)).filter(
    element => {
      const style = window.getComputedStyle(element);
      return (
        style.display !== 'none' &&
        style.visibility !== 'hidden' &&
        !element.hasAttribute('aria-hidden')
      );
    }
  );
};

/**
 * Trap focus within a container (useful for modals, dropdowns)
 */
export const trapFocus = (container: Element, event: KeyboardEvent): void => {
  if (event.key !== KEYBOARD_KEYS.TAB) return;

  const focusableElements = getFocusableElements(container);
  if (focusableElements.length === 0) return;

  const firstElement = focusableElements[0] as HTMLElement;
  const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement;

  if (event.shiftKey) {
    // Shift + Tab (backward)
    if (document.activeElement === firstElement) {
      event.preventDefault();
      lastElement.focus();
    }
  } else {
    // Tab (forward)
    if (document.activeElement === lastElement) {
      event.preventDefault();
      firstElement.focus();
    }
  }
};

/**
 * Handle arrow key navigation in a list
 */
export const handleArrowNavigation = (
  event: KeyboardEvent,
  items: Element[],
  currentIndex: number,
  onIndexChange: (index: number) => void,
  options: {
    wrap?: boolean;
    orientation?: 'horizontal' | 'vertical' | 'both';
  } = {}
): void => {
  const { wrap = true, orientation = 'vertical' } = options;
  
  let newIndex = currentIndex;

  switch (event.key) {
    case KEYBOARD_KEYS.ARROW_UP:
      if (orientation === 'vertical' || orientation === 'both') {
        event.preventDefault();
        newIndex = currentIndex > 0 ? currentIndex - 1 : wrap ? items.length - 1 : currentIndex;
      }
      break;

    case KEYBOARD_KEYS.ARROW_DOWN:
      if (orientation === 'vertical' || orientation === 'both') {
        event.preventDefault();
        newIndex = currentIndex < items.length - 1 ? currentIndex + 1 : wrap ? 0 : currentIndex;
      }
      break;

    case KEYBOARD_KEYS.ARROW_LEFT:
      if (orientation === 'horizontal' || orientation === 'both') {
        event.preventDefault();
        newIndex = currentIndex > 0 ? currentIndex - 1 : wrap ? items.length - 1 : currentIndex;
      }
      break;

    case KEYBOARD_KEYS.ARROW_RIGHT:
      if (orientation === 'horizontal' || orientation === 'both') {
        event.preventDefault();
        newIndex = currentIndex < items.length - 1 ? currentIndex + 1 : wrap ? 0 : currentIndex;
      }
      break;

    case KEYBOARD_KEYS.HOME:
      event.preventDefault();
      newIndex = 0;
      break;

    case KEYBOARD_KEYS.END:
      event.preventDefault();
      newIndex = items.length - 1;
      break;

    default:
      return;
  }

  if (newIndex !== currentIndex) {
    onIndexChange(newIndex);
    (items[newIndex] as HTMLElement)?.focus();
  }
};

/**
 * Handle typeahead search in a list
 */
export const handleTypeahead = (
  event: KeyboardEvent,
  items: Element[],
  getText: (item: Element) => string,
  onMatch: (index: number) => void,
  timeout: number = 1000
): void => {
  // Only handle printable characters
  if (event.key.length !== 1 || event.ctrlKey || event.altKey || event.metaKey) {
    return;
  }

  const char = event.key.toLowerCase();
  const currentTime = Date.now();

  // Use a closure to maintain search state
  if (!handleTypeahead.searchState) {
    handleTypeahead.searchState = {
      searchString: '',
      lastTime: 0,
    };
  }

  const state = handleTypeahead.searchState;

  // Reset search if timeout exceeded
  if (currentTime - state.lastTime > timeout) {
    state.searchString = '';
  }

  state.searchString += char;
  state.lastTime = currentTime;

  // Find matching item
  const matchIndex = items.findIndex(item => {
    const text = getText(item).toLowerCase();
    return text.startsWith(state.searchString);
  });

  if (matchIndex !== -1) {
    event.preventDefault();
    onMatch(matchIndex);
  }
};

// Add static property to function for state management
(handleTypeahead as any).searchState = null;

/**
 * Announce text to screen readers
 */
export const announceToScreenReader = (message: string, priority: 'polite' | 'assertive' = 'polite'): void => {
  const announcement = document.createElement('div');
  announcement.setAttribute('aria-live', priority);
  announcement.setAttribute('aria-atomic', 'true');
  announcement.setAttribute('class', 'sr-only');
  announcement.style.position = 'absolute';
  announcement.style.left = '-10000px';
  announcement.style.width = '1px';
  announcement.style.height = '1px';
  announcement.style.overflow = 'hidden';

  document.body.appendChild(announcement);
  announcement.textContent = message;

  // Remove after announcement
  setTimeout(() => {
    document.body.removeChild(announcement);
  }, 1000);
};

/**
 * Skip link functionality
 */
export const createSkipLink = (targetId: string, text: string): HTMLElement => {
  const skipLink = document.createElement('a');
  skipLink.href = `#${targetId}`;
  skipLink.textContent = text;
  skipLink.className = 'skip-link';
  
  // Style the skip link
  Object.assign(skipLink.style, {
    position: 'absolute',
    top: '-40px',
    left: '6px',
    background: '#000',
    color: '#fff',
    padding: '8px',
    textDecoration: 'none',
    borderRadius: '4px',
    zIndex: '1000',
    transition: 'top 0.3s',
  });

  skipLink.addEventListener('focus', () => {
    skipLink.style.top = '6px';
  });

  skipLink.addEventListener('blur', () => {
    skipLink.style.top = '-40px';
  });

  return skipLink;
};

/**
 * Manage focus restoration after modal/dialog closes
 */
export class FocusManager {
  private previousFocus: HTMLElement | null = null;

  saveFocus(): void {
    this.previousFocus = document.activeElement as HTMLElement;
  }

  restoreFocus(): void {
    if (this.previousFocus && typeof this.previousFocus.focus === 'function') {
      this.previousFocus.focus();
    }
  }

  setInitialFocus(container: Element): void {
    const focusableElements = getFocusableElements(container);
    if (focusableElements.length > 0) {
      (focusableElements[0] as HTMLElement).focus();
    }
  }
}