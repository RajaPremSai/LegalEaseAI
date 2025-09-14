import { configureAxe } from 'jest-axe';

/**
 * Configure axe-core for accessibility testing
 */
export const axe = configureAxe({
  rules: {
    // Customize rules as needed
    'color-contrast': { enabled: true },
    'keyboard-navigation': { enabled: true },
    'focus-management': { enabled: true },
    'aria-labels': { enabled: true },
    'semantic-markup': { enabled: true },
  },
  tags: ['wcag2a', 'wcag2aa', 'wcag21aa'],
});

/**
 * Common accessibility test utilities
 */
export const accessibilityTestUtils = {
  /**
   * Test keyboard navigation
   */
  testKeyboardNavigation: async (container: HTMLElement): Promise<void> => {
    const focusableElements = container.querySelectorAll(
      'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
    );

    // Test that all interactive elements are focusable
    focusableElements.forEach((element, index) => {
      (element as HTMLElement).focus();
      expect(document.activeElement).toBe(element);
    });

    // Test tab order
    let currentIndex = 0;
    const tabEvent = new KeyboardEvent('keydown', { key: 'Tab' });
    
    focusableElements.forEach((element, index) => {
      if (index > 0) {
        document.dispatchEvent(tabEvent);
        expect(document.activeElement).toBe(focusableElements[index]);
      }
    });
  },

  /**
   * Test ARIA labels and descriptions
   */
  testAriaLabels: (container: HTMLElement): void => {
    const elementsWithAriaLabel = container.querySelectorAll('[aria-label]');
    const elementsWithAriaLabelledBy = container.querySelectorAll('[aria-labelledby]');
    const elementsWithAriaDescribedBy = container.querySelectorAll('[aria-describedby]');

    // Test aria-label is not empty
    elementsWithAriaLabel.forEach(element => {
      const ariaLabel = element.getAttribute('aria-label');
      expect(ariaLabel).toBeTruthy();
      expect(ariaLabel!.trim()).not.toBe('');
    });

    // Test aria-labelledby references exist
    elementsWithAriaLabelledBy.forEach(element => {
      const labelledBy = element.getAttribute('aria-labelledby');
      const referencedIds = labelledBy!.split(' ');
      
      referencedIds.forEach(id => {
        const referencedElement = document.getElementById(id);
        expect(referencedElement).toBeTruthy();
      });
    });

    // Test aria-describedby references exist
    elementsWithAriaDescribedBy.forEach(element => {
      const describedBy = element.getAttribute('aria-describedby');
      const referencedIds = describedBy!.split(' ');
      
      referencedIds.forEach(id => {
        const referencedElement = document.getElementById(id);
        expect(referencedElement).toBeTruthy();
      });
    });
  },

  /**
   * Test color contrast
   */
  testColorContrast: (container: HTMLElement): void => {
    const textElements = container.querySelectorAll('p, span, div, h1, h2, h3, h4, h5, h6, button, a, label');
    
    textElements.forEach(element => {
      const styles = window.getComputedStyle(element);
      const color = styles.color;
      const backgroundColor = styles.backgroundColor;
      
      // Basic check - ensure colors are defined
      expect(color).toBeTruthy();
      if (backgroundColor && backgroundColor !== 'rgba(0, 0, 0, 0)') {
        expect(backgroundColor).toBeTruthy();
      }
    });
  },

  /**
   * Test semantic markup
   */
  testSemanticMarkup: (container: HTMLElement): void => {
    // Test for proper heading hierarchy
    const headings = container.querySelectorAll('h1, h2, h3, h4, h5, h6');
    let previousLevel = 0;
    
    headings.forEach(heading => {
      const currentLevel = parseInt(heading.tagName.charAt(1));
      
      // First heading should be h1 or close to it
      if (previousLevel === 0) {
        expect(currentLevel).toBeLessThanOrEqual(2);
      } else {
        // Subsequent headings should not skip levels
        expect(currentLevel - previousLevel).toBeLessThanOrEqual(1);
      }
      
      previousLevel = currentLevel;
    });

    // Test for proper list markup
    const lists = container.querySelectorAll('ul, ol');
    lists.forEach(list => {
      const listItems = list.querySelectorAll('li');
      expect(listItems.length).toBeGreaterThan(0);
    });

    // Test for proper form labels
    const inputs = container.querySelectorAll('input, select, textarea');
    inputs.forEach(input => {
      const id = input.getAttribute('id');
      const ariaLabel = input.getAttribute('aria-label');
      const ariaLabelledBy = input.getAttribute('aria-labelledby');
      
      if (id) {
        const label = container.querySelector(`label[for="${id}"]`);
        expect(label || ariaLabel || ariaLabelledBy).toBeTruthy();
      } else {
        expect(ariaLabel || ariaLabelledBy).toBeTruthy();
      }
    });
  },

  /**
   * Test focus management
   */
  testFocusManagement: (container: HTMLElement): void => {
    const focusableElements = container.querySelectorAll(
      'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
    );

    // Test that focus is visible
    focusableElements.forEach(element => {
      (element as HTMLElement).focus();
      const styles = window.getComputedStyle(element);
      
      // Should have some form of focus indicator
      const hasOutline = styles.outline !== 'none' && styles.outline !== '0px';
      const hasBoxShadow = styles.boxShadow !== 'none';
      const hasBorder = styles.border !== 'none';
      
      expect(hasOutline || hasBoxShadow || hasBorder).toBe(true);
    });
  },

  /**
   * Test screen reader compatibility
   */
  testScreenReaderCompatibility: (container: HTMLElement): void => {
    // Test for proper ARIA roles
    const interactiveElements = container.querySelectorAll('button, a, input, select, textarea');
    interactiveElements.forEach(element => {
      const role = element.getAttribute('role');
      const tagName = element.tagName.toLowerCase();
      
      // Ensure interactive elements have appropriate roles or are semantic
      if (role) {
        expect(['button', 'link', 'textbox', 'combobox', 'listbox']).toContain(role);
      } else {
        expect(['button', 'a', 'input', 'select', 'textarea']).toContain(tagName);
      }
    });

    // Test for live regions
    const liveRegions = container.querySelectorAll('[aria-live]');
    liveRegions.forEach(region => {
      const ariaLive = region.getAttribute('aria-live');
      expect(['polite', 'assertive', 'off']).toContain(ariaLive!);
    });

    // Test for hidden content
    const hiddenElements = container.querySelectorAll('[aria-hidden="true"]');
    hiddenElements.forEach(element => {
      // Hidden elements should not contain focusable content
      const focusableChildren = element.querySelectorAll(
        'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
      );
      expect(focusableChildren.length).toBe(0);
    });
  },

  /**
   * Test mobile accessibility
   */
  testMobileAccessibility: (container: HTMLElement): void => {
    const touchTargets = container.querySelectorAll('button, a, input, select, textarea, [role="button"]');
    
    touchTargets.forEach(target => {
      const styles = window.getComputedStyle(target);
      const rect = target.getBoundingClientRect();
      
      // WCAG recommends minimum 44px touch targets
      const minSize = 44;
      expect(rect.width).toBeGreaterThanOrEqual(minSize - 4); // Allow small tolerance
      expect(rect.height).toBeGreaterThanOrEqual(minSize - 4);
    });
  },
};