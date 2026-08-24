/**
 * Maps axe-core rule IDs to the WCAG 2.1 success criteria they evidence, plus two
 * judgements the raw axe output does not give you:
 *
 *   severity          - how badly this blocks a real user from finishing a task.
 *   litigationSalience- how often this failure class actually shows up in ADA
 *                       website demand letters and complaints.
 *
 * The second column is what turns a scan into a sales conversation. A contrast
 * failure and a missing form label are both "serious" to axe; only one of them
 * reliably ends up quoted in a demand letter.
 */

export const SEVERITY = { blocker: 3, major: 2, minor: 1 };
export const SALIENCE = { high: 3, medium: 2, low: 1 };

/** Rules not listed here fall back to DEFAULT_RULE. */
export const RULE_MAP = {
  // --- Text alternatives -------------------------------------------------
  'image-alt':            { sc: ['1.1.1'], severity: 'blocker', litigationSalience: 'high',
                            plain: 'Images have no text alternative, so screen readers announce nothing or read the filename.' },
  'input-image-alt':      { sc: ['1.1.1'], severity: 'blocker', litigationSalience: 'high',
                            plain: 'Image buttons have no text alternative, so their purpose is unannounced.' },
  'area-alt':             { sc: ['1.1.1'], severity: 'major',   litigationSalience: 'medium',
                            plain: 'Image map areas have no text alternative.' },
  'object-alt':           { sc: ['1.1.1'], severity: 'major',   litigationSalience: 'low',
                            plain: 'Embedded objects have no text alternative.' },
  'svg-img-alt':          { sc: ['1.1.1'], severity: 'major',   litigationSalience: 'medium',
                            plain: 'Meaningful SVG graphics have no accessible name.' },

  // --- Names on interactive controls -------------------------------------
  'link-name':            { sc: ['2.4.4', '4.1.2'], severity: 'blocker', litigationSalience: 'high',
                            plain: 'Links have no discernible text, so a screen reader announces "link" with no destination.' },
  'button-name':          { sc: ['4.1.2'], severity: 'blocker', litigationSalience: 'high',
                            plain: 'Buttons have no accessible name, so their action is unannounced.' },
  'label':                { sc: ['1.3.1', '3.3.2', '4.1.2'], severity: 'blocker', litigationSalience: 'high',
                            plain: 'Form fields have no associated label, so users cannot tell what to type.' },
  'select-name':          { sc: ['4.1.2'], severity: 'blocker', litigationSalience: 'high',
                            plain: 'Select menus have no accessible name.' },
  'form-field-multiple-labels': { sc: ['3.3.2'], severity: 'major', litigationSalience: 'medium',
                            plain: 'Form fields carry conflicting labels, producing ambiguous announcements.' },
  'frame-title':          { sc: ['2.4.1', '4.1.2'], severity: 'major', litigationSalience: 'medium',
                            plain: 'Iframes have no title, so their content is unidentified.' },

  // --- Contrast ----------------------------------------------------------
  'color-contrast':       { sc: ['1.4.3'], severity: 'major', litigationSalience: 'high',
                            plain: 'Text does not meet the 4.5:1 contrast minimum against its background.' },
  'color-contrast-enhanced': { sc: ['1.4.6'], severity: 'minor', litigationSalience: 'low',
                            plain: 'Text does not meet the stricter AAA contrast level. Not required at AA.' },
  'link-in-text-block':   { sc: ['1.4.1'], severity: 'major', litigationSalience: 'medium',
                            plain: 'Links are distinguished from surrounding text by colour alone.' },

  // --- Structure and navigation ------------------------------------------
  'document-title':       { sc: ['2.4.2'], severity: 'blocker', litigationSalience: 'high',
                            plain: 'The page has no title, so it is unidentifiable in tabs, history and screen readers.' },
  'html-has-lang':        { sc: ['3.1.1'], severity: 'major', litigationSalience: 'high',
                            plain: 'The page does not declare a language, so screen readers may use the wrong pronunciation rules.' },
  'html-lang-valid':      { sc: ['3.1.1'], severity: 'major', litigationSalience: 'medium',
                            plain: 'The declared page language is not a valid language code.' },
  'bypass':               { sc: ['2.4.1'], severity: 'major', litigationSalience: 'medium',
                            plain: 'There is no way to skip repeated navigation and jump to the main content.' },
  'heading-order':        { sc: ['1.3.1'], severity: 'major', litigationSalience: 'medium',
                            plain: 'Heading levels skip, breaking the document outline screen reader users navigate by.' },
  'empty-heading':        { sc: ['1.3.1'], severity: 'major', litigationSalience: 'medium',
                            plain: 'Headings contain no text.' },
  'landmark-one-main':    { sc: ['1.3.1'], severity: 'minor', litigationSalience: 'low',
                            plain: 'The page has no main landmark for jumping straight to primary content.' },
  'region':               { sc: ['1.3.1'], severity: 'minor', litigationSalience: 'low',
                            plain: 'Some content sits outside any landmark region.' },
  'list':                 { sc: ['1.3.1'], severity: 'minor', litigationSalience: 'low',
                            plain: 'List markup is malformed, so item counts are announced incorrectly.' },
  'definition-list':      { sc: ['1.3.1'], severity: 'minor', litigationSalience: 'low',
                            plain: 'Definition list markup is malformed.' },
  'listitem':             { sc: ['1.3.1'], severity: 'minor', litigationSalience: 'low',
                            plain: 'List items are not contained in a parent list.' },
  'th-has-data-cells':    { sc: ['1.3.1'], severity: 'major', litigationSalience: 'low',
                            plain: 'Table headers are not associated with data cells.' },
  'td-headers-attr':      { sc: ['1.3.1'], severity: 'major', litigationSalience: 'low',
                            plain: 'Table cells reference headers that do not exist.' },

  // --- ARIA --------------------------------------------------------------
  'aria-required-attr':   { sc: ['4.1.2'], severity: 'blocker', litigationSalience: 'medium',
                            plain: 'ARIA roles are missing required attributes, so widget state is unannounced.' },
  'aria-required-children': { sc: ['1.3.1'], severity: 'blocker', litigationSalience: 'medium',
                            plain: 'ARIA roles are missing required child roles, breaking the widget structure.' },
  'aria-required-parent': { sc: ['1.3.1'], severity: 'blocker', litigationSalience: 'medium',
                            plain: 'ARIA roles sit outside their required parent role.' },
  'aria-valid-attr-value':{ sc: ['4.1.2'], severity: 'major', litigationSalience: 'medium',
                            plain: 'ARIA attributes carry invalid values, commonly pointing at IDs that do not exist.' },
  'aria-hidden-focus':    { sc: ['1.3.1', '4.1.2'], severity: 'blocker', litigationSalience: 'medium',
                            plain: 'Focusable elements are hidden from screen readers, stranding keyboard users on invisible controls.' },
  'aria-hidden-body':     { sc: ['4.1.2'], severity: 'blocker', litigationSalience: 'medium',
                            plain: 'The document body is hidden from assistive technology entirely.' },
  'aria-roles':           { sc: ['4.1.2'], severity: 'major', litigationSalience: 'low',
                            plain: 'Elements use ARIA roles that are not valid.' },
  'aria-allowed-attr':    { sc: ['4.1.2'], severity: 'major', litigationSalience: 'low',
                            plain: 'ARIA attributes are not permitted on the roles they are applied to.' },
  'duplicate-id-aria':    { sc: ['4.1.1'], severity: 'major', litigationSalience: 'low',
                            plain: 'Duplicate IDs break the ARIA references that depend on them.' },

  // --- Media and motion ---------------------------------------------------
  'video-caption':        { sc: ['1.2.2'], severity: 'blocker', litigationSalience: 'high',
                            plain: 'Video has no captions, excluding deaf and hard-of-hearing users.' },
  'audio-caption':        { sc: ['1.2.1'], severity: 'blocker', litigationSalience: 'high',
                            plain: 'Audio has no captions or transcript.' },
  'no-autoplay-audio':    { sc: ['1.4.2'], severity: 'major', litigationSalience: 'medium',
                            plain: 'Audio plays automatically and cannot be stopped, drowning out screen reader speech.' },
  'blink':                { sc: ['2.2.2'], severity: 'major', litigationSalience: 'low',
                            plain: 'Content blinks with no way to stop it.' },
  'marquee':              { sc: ['2.2.2'], severity: 'major', litigationSalience: 'low',
                            plain: 'Content scrolls automatically with no way to stop it.' },
  'meta-refresh':         { sc: ['2.2.1'], severity: 'major', litigationSalience: 'low',
                            plain: 'The page refreshes on a timer users cannot control or extend.' },

  // --- Zoom and viewport ---------------------------------------------------
  'meta-viewport':        { sc: ['1.4.4'], severity: 'major', litigationSalience: 'high',
                            plain: 'Zoom is disabled, so low-vision users cannot enlarge text on mobile.' },

  // --- Keyboard ------------------------------------------------------------
  'tabindex':             { sc: ['2.4.3'], severity: 'major', litigationSalience: 'medium',
                            plain: 'Positive tabindex values force an unnatural, confusing keyboard order.' },
  'accesskeys':           { sc: ['2.1.1'], severity: 'minor', litigationSalience: 'low',
                            plain: 'Duplicate access keys create conflicting keyboard shortcuts.' },
  'scrollable-region-focusable': { sc: ['2.1.1'], severity: 'blocker', litigationSalience: 'medium',
                            plain: 'Scrollable regions cannot be reached or scrolled by keyboard.' },
};

export const DEFAULT_RULE = {
  sc: [], severity: 'minor', litigationSalience: 'low',
  plain: 'Automated check failed. See the axe-core rule description for detail.',
};

export function describe(ruleId) {
  return RULE_MAP[ruleId] ?? DEFAULT_RULE;
}

/**
 * Ranks a finding for the remediation queue.
 *
 * Instance count is deliberately dampened with a log: 400 contrast failures from
 * one bad brand colour is a single half-hour fix, and should not outrank a form
 * nobody can submit. Pages-affected is weighted harder, because a failure on
 * every page is almost always a template or design-token problem.
 */
export function priority({ ruleId, instances, pagesAffected }) {
  const rule = describe(ruleId);
  const sev = SEVERITY[rule.severity] ?? 1;
  const sal = SALIENCE[rule.litigationSalience] ?? 1;
  const spread = 1 + Math.log10(Math.max(1, pagesAffected)) * 1.5;
  const volume = 1 + Math.log10(Math.max(1, instances)) * 0.5;
  return Number((sev * sal * spread * volume).toFixed(2));
}
