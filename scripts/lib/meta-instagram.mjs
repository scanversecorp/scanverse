/**
 * Meta Instagram Graph API — create + publish feed posts.
 * @see docs/social/AUTOMATION.md
 */

const DEFAULT_VERSION = 'v21.0';

function graphUrl(path, version) {
  const v = version || process.env.META_GRAPH_API_VERSION || DEFAULT_VERSION;
  return `https://graph.facebook.com/${v}${path}`;
}

async function graphPost(path, params, version) {
  const body = new URLSearchParams(params);
  const res = await fetch(graphUrl(path, version), { method: 'POST', body });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json.error) {
    const msg = json.error?.message || res.statusText || 'Graph API error';
    const code = json.error?.code;
    const err = new Error(`Meta Graph API: ${msg}${code ? ` (${code})` : ''}`);
    err.graph = json.error;
    err.status = res.status;
    throw err;
  }
  return json;
}

async function graphGet(path, params, version) {
  const qs = new URLSearchParams({ ...params, access_token: params.access_token });
  const res = await fetch(`${graphUrl(path, version)}?${qs}`);
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json.error) {
    const msg = json.error?.message || res.statusText || 'Graph API error';
    throw new Error(`Meta Graph API: ${msg}`);
  }
  return json;
}

/** Verify token + return IG business account id if META_IG_USER_ID not set. */
export async function resolveIgUserId({ pageId, accessToken, version } = {}) {
  if (process.env.META_IG_USER_ID) return process.env.META_IG_USER_ID;
  const pid = pageId || process.env.META_PAGE_ID;
  if (!pid || !accessToken) {
    throw new Error('Set META_IG_USER_ID or META_PAGE_ID + META_PAGE_ACCESS_TOKEN');
  }
  const data = await graphGet(`/${pid}`, {
    fields: 'instagram_business_account',
    access_token: accessToken,
  }, version);
  const id = data.instagram_business_account?.id;
  if (!id) throw new Error('Facebook Page has no linked Instagram Business account');
  return id;
}

/** Step 1: create media container. */
export async function createInstagramMedia({
  igUserId,
  accessToken,
  imageUrl,
  caption,
  version,
}) {
  return graphPost(`/${igUserId}/media`, {
    image_url: imageUrl,
    caption: caption || '',
    access_token: accessToken,
  }, version);
}

/** Step 2: publish container (may need brief wait — caller retries). */
export async function publishInstagramMedia({
  igUserId,
  accessToken,
  creationId,
  version,
}) {
  return graphPost(`/${igUserId}/media_publish`, {
    creation_id: creationId,
    access_token: accessToken,
  }, version);
}

export async function publishInstagramPhoto({
  igUserId,
  accessToken,
  imageUrl,
  caption,
  version,
  maxWaitMs = 60000,
}) {
  const created = await createInstagramMedia({ igUserId, accessToken, imageUrl, caption, version });
  const creationId = created.id;
  if (!creationId) throw new Error('No creation id returned from Meta');

  const start = Date.now();
  let lastErr;
  while (Date.now() - start < maxWaitMs) {
    try {
      const published = await publishInstagramMedia({
        igUserId, accessToken, creationId, version,
      });
      return { creationId, mediaId: published.id, published };
    } catch (e) {
      lastErr = e;
      const code = e.graph?.code;
      // Media not ready yet
      if (code === 9007 || /not ready|in progress/i.test(e.message)) {
        await new Promise((r) => setTimeout(r, 3000));
        continue;
      }
      throw e;
    }
  }
  throw lastErr || new Error('Timed out waiting for Instagram media publish');
}
