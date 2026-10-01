/**
 * RancangLoka — Meta Account & Page Discovery Service
 * Milestone: SOCIAL-S3.5
 *
 * Implements normalized account discovery:
 * 1. Facebook Login: Discovers managed Pages, publish permissions, and linked Instagram Professional accounts.
 * 2. Instagram Login: Discovers direct Instagram Professional identity without requiring FB Page linkage.
 *
 * Invariant: ZERO RAW SECRETS.
 * No access token or App Secret is exposed in return structures or diagnostic objects.
 */

import type {
  DiscoveredFacebookPage,
  DiscoveredInstagramAccount,
  MetaAccountDiscoveryResult,
  MetaAuthMode,
} from './binding-types.ts';

/**
 * Normalize Facebook Pages API response (GET /me/accounts)
 *
 * Verified Graph API response shape:
 * {
 *   data: [
 *     {
 *       id: "10987654321",
 *       name: "RancangLoka ID",
 *       category: "Media/News Company",
 *       tasks: ["ANALYZE", "ADVERTISE", "MODERATE", "CREATE_CONTENT", "MANAGE"],
 *       instagram_business_account?: { id: "17841400000000000", username: "rancangloka.id" }
 *     }
 *   ]
 * }
 */
export function normalizeFacebookPagesDiscovery(
  rawAccountsPayload: any,
  operatorId: string,
  operatorName?: string
): MetaAccountDiscoveryResult {
  const data = Array.isArray(rawAccountsPayload?.data) ? rawAccountsPayload.data : [];
  const facebookPages: DiscoveredFacebookPage[] = [];
  const instagramAccounts: DiscoveredInstagramAccount[] = [];

  for (const item of data) {
    const pageId = String(item.id || '');
    if (!pageId) continue;

    const tasks: string[] = Array.isArray(item.tasks) ? item.tasks : [];
    // Page publishing requires CREATE_CONTENT or MANAGE task
    const hasPublishPermission =
      tasks.includes('CREATE_CONTENT') || tasks.includes('MANAGE') || tasks.includes('PUBLISH');

    const igAccount = item.instagram_business_account;
    const hasLinkedInstagram = Boolean(igAccount && igAccount.id);

    facebookPages.push({
      pageId,
      name: String(item.name || `Page ${pageId}`),
      category: item.category ? String(item.category) : undefined,
      tasks,
      hasLinkedInstagram,
      linkedInstagramId: hasLinkedInstagram ? String(igAccount.id) : null,
      linkedInstagramUsername: hasLinkedInstagram ? String(igAccount.username || '') : null,
      hasPublishPermission,
    });

    if (hasLinkedInstagram) {
      instagramAccounts.push({
        instagramId: String(igAccount.id),
        username: String(igAccount.username || `ig_${igAccount.id}`),
        name: igAccount.name ? String(igAccount.name) : undefined,
        accountType: 'BUSINESS',
        sourceAuthMode: 'FACEBOOK_LOGIN',
        linkedFacebookPageId: pageId,
      });
    }
  }

  return {
    authMode: 'FACEBOOK_LOGIN',
    operatorIdentity: {
      userId: operatorId,
      userName: operatorName,
    },
    facebookPages,
    instagramAccounts,
    discoveredAt: new Date().toISOString(),
  };
}

/**
 * Normalize Direct Instagram Login Discovery response (GET /me)
 *
 * Verified Instagram Basic Display / Graph API shape:
 * {
 *   id: "17841499999999999",
 *   username: "rancangloka.official",
 *   account_type: "BUSINESS", // or "MEDIA_CREATOR"
 *   profile_picture_url?: "..."
 * }
 */
export function normalizeInstagramLoginDiscovery(
  rawMePayload: any,
  operatorId: string
): MetaAccountDiscoveryResult {
  const igId = String(rawMePayload?.id || operatorId);
  const username = String(rawMePayload?.username || `ig_${igId}`);
  const rawType = String(rawMePayload?.account_type || 'BUSINESS').toUpperCase();

  const accountType: 'BUSINESS' | 'MEDIA_CREATOR' | 'PERSONAL' =
    rawType === 'MEDIA_CREATOR' ? 'MEDIA_CREATOR' : rawType === 'PERSONAL' ? 'PERSONAL' : 'BUSINESS';

  const instagramAccounts: DiscoveredInstagramAccount[] = [
    {
      instagramId: igId,
      username,
      name: rawMePayload?.name ? String(rawMePayload.name) : undefined,
      profilePictureUrl: rawMePayload?.profile_picture_url ? String(rawMePayload.profile_picture_url) : undefined,
      accountType,
      sourceAuthMode: 'INSTAGRAM_LOGIN',
      linkedFacebookPageId: null, // Direct login does not link to FB Page
    },
  ];

  return {
    authMode: 'INSTAGRAM_LOGIN',
    operatorIdentity: {
      userId: operatorId,
      userName: username,
    },
    facebookPages: [], // Direct Instagram login discovers zero FB Pages
    instagramAccounts,
    discoveredAt: new Date().toISOString(),
  };
}
