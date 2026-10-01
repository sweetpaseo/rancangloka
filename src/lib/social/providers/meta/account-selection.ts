/**
 * RancangLoka — Explicit Account Selection & Target Binding Service
 * Milestone: SOCIAL-S3.6
 *
 * Requirements:
 * 1. NEVER auto-select first result when multiple Facebook Pages are returned.
 * 2. Require operator to explicitly choose the target Page ID.
 * 3. Inspect linked Instagram Professional account if present.
 * 4. Require explicit operator confirmation before persisting target binding.
 *
 * Invariant: ZERO RAW SECRETS.
 */

import type {
  DiscoveredFacebookPage,
  DiscoveredInstagramAccount,
  MetaAccountDiscoveryResult,
  SelectedFacebookPageBinding,
  SelectedInstagramAccountBinding,
} from './binding-types.ts';

export interface AccountSelectionDecision {
  requiresOperatorSelection: boolean;
  requiresOperatorConfirmation: boolean;
  availablePages: DiscoveredFacebookPage[];
  selectedPage: DiscoveredFacebookPage | null;
  selectedInstagram: DiscoveredInstagramAccount | null;
  targetFacebookBinding: SelectedFacebookPageBinding | null;
  targetInstagramBinding: SelectedInstagramAccountBinding | null;
  statusMessage: string;
}

/**
 * Deterministically evaluate account selection from discovery results.
 * Strictly prevents automatic first-item selection when ambiguity exists.
 */
export function evaluateAccountSelection(params: {
  discovery: MetaAccountDiscoveryResult;
  selectedPageId?: string | null;
  explicitConfirmation?: boolean;
}): AccountSelectionDecision {
  const { discovery, selectedPageId, explicitConfirmation = false } = params;

  // Case 1: Direct Instagram Login (no Facebook Pages)
  if (discovery.authMode === 'INSTAGRAM_LOGIN') {
    const ig = discovery.instagramAccounts[0] || null;
    return {
      requiresOperatorSelection: false,
      requiresOperatorConfirmation: !explicitConfirmation,
      availablePages: [],
      selectedPage: null,
      selectedInstagram: ig,
      targetFacebookBinding: null,
      targetInstagramBinding: ig
        ? {
            instagramId: ig.instagramId,
            username: ig.username,
            name: ig.name,
            accountType: ig.accountType,
          }
        : null,
      statusMessage: explicitConfirmation
        ? 'Direct Instagram target confirmed by operator.'
        : 'Instagram account discovered. Operator confirmation required.',
    };
  }

  // Case 2: Facebook Login with zero pages
  const pages = discovery.facebookPages || [];
  if (pages.length === 0) {
    return {
      requiresOperatorSelection: false,
      requiresOperatorConfirmation: false,
      availablePages: [],
      selectedPage: null,
      selectedInstagram: null,
      targetFacebookBinding: null,
      targetInstagramBinding: null,
      statusMessage: 'NO_PAGES_DISCOVERED: No managed Facebook Pages found for this user account.',
    };
  }

  // Case 3: Multiple Pages and no explicit page ID provided
  // Strictly prevent auto-selection of the first result!
  if (pages.length > 1 && !selectedPageId) {
    return {
      requiresOperatorSelection: true,
      requiresOperatorConfirmation: false,
      availablePages: pages,
      selectedPage: null,
      selectedInstagram: null,
      targetFacebookBinding: null,
      targetInstagramBinding: null,
      statusMessage: `MULTIPLE_PAGES_DISCOVERED: Found ${pages.length} Facebook Pages. Operator must explicitly select target Page.`,
    };
  }

  // Case 4: Target page identified (either single page or explicitly selected)
  const targetPageId = selectedPageId || (pages.length === 1 ? pages[0].pageId : null);
  const matchedPage = pages.find((p) => p.pageId === targetPageId);

  if (!matchedPage) {
    return {
      requiresOperatorSelection: true,
      requiresOperatorConfirmation: false,
      availablePages: pages,
      selectedPage: null,
      selectedInstagram: null,
      targetFacebookBinding: null,
      targetInstagramBinding: null,
      statusMessage: `PAGE_NOT_FOUND: Selected Page ID "${selectedPageId}" was not found in discovered pages.`,
    };
  }

  // Find linked Instagram account for this page if available
  const linkedIg = discovery.instagramAccounts.find(
    (ig) => ig.linkedFacebookPageId === matchedPage.pageId || ig.instagramId === matchedPage.linkedInstagramId
  ) || null;

  const targetFacebookBinding: SelectedFacebookPageBinding = {
    pageId: matchedPage.pageId,
    name: matchedPage.name,
    category: matchedPage.category,
    tasks: matchedPage.tasks,
  };

  const targetInstagramBinding: SelectedInstagramAccountBinding | null = linkedIg
    ? {
        instagramId: linkedIg.instagramId,
        username: linkedIg.username,
        name: linkedIg.name,
        accountType: linkedIg.accountType,
      }
    : null;

  if (!explicitConfirmation) {
    return {
      requiresOperatorSelection: false,
      requiresOperatorConfirmation: true,
      availablePages: pages,
      selectedPage: matchedPage,
      selectedInstagram: linkedIg,
      targetFacebookBinding,
      targetInstagramBinding,
      statusMessage: 'Target Facebook Page and linked Instagram identified. Awaiting operator final confirmation.',
    };
  }

  return {
    requiresOperatorSelection: false,
    requiresOperatorConfirmation: false,
    availablePages: pages,
    selectedPage: matchedPage,
    selectedInstagram: linkedIg,
    targetFacebookBinding,
    targetInstagramBinding,
    statusMessage: 'Operator confirmed target Facebook Page and Instagram bindings.',
  };
}
