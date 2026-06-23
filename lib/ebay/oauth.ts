/**
 * eBay OAuth 2.0 (Authorization Code grant) over plain fetch — no SDK.
 *
 * The owner connects their eBay seller account once; we store only the
 * long-lived refresh token and exchange it for short-lived access tokens on
 * demand (same pattern as the Google integration in lib/google.ts).
 *
 * Required env:
 *   EBAY_CLIENT_ID      — App-ID (Client-ID) aus dem eBay-Developer-Portal
 *   EBAY_CLIENT_SECRET  — Cert-ID (Client-Secret)
 *   EBAY_RU_NAME        — RuName (Redirect-URL-Name) aus dem Portal
 *   EBAY_ENV            — "production" (Standard) oder "sandbox"
 */

export type EbayEnv = 'production' | 'sandbox';

/** OAuth scopes needed to create and publish inventory-based listings. */
const SCOPES = [
  'https://api.ebay.com/oauth/api_scope/sell.inventory',
  'https://api.ebay.com/oauth/api_scope/sell.account',
];

export function ebayEnv(): EbayEnv {
  return process.env.EBAY_ENV === 'sandbox' ? 'sandbox' : 'production';
}

export function ebayConfigured(): boolean {
  return Boolean(process.env.EBAY_CLIENT_ID && process.env.EBAY_CLIENT_SECRET && process.env.EBAY_RU_NAME);
}

/** Base hostnames differ between the live and sandbox environments. */
export function ebayHosts(env: EbayEnv = ebayEnv()) {
  const sandbox = env === 'sandbox';
  return {
    auth: sandbox ? 'https://auth.sandbox.ebay.com' : 'https://auth.ebay.com',
    api: sandbox ? 'https://api.sandbox.ebay.com' : 'https://api.ebay.com',
  };
}

function basicAuthHeader(): string {
  const raw = `${process.env.EBAY_CLIENT_ID}:${process.env.EBAY_CLIENT_SECRET}`;
  return `Basic ${Buffer.from(raw).toString('base64')}`;
}

/** Build the consent URL. `state` carries the user id so the callback can store the token. */
export function ebayAuthUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: process.env.EBAY_CLIENT_ID!,
    redirect_uri: process.env.EBAY_RU_NAME!, // eBay expects the RuName here, not a raw URL
    response_type: 'code',
    scope: SCOPES.join(' '),
    state,
    prompt: 'login',
  });
  return `${ebayHosts().auth}/oauth2/authorize?${params.toString()}`;
}

interface TokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  refresh_token_expires_in?: number;
}

/** Exchange the one-time auth code for tokens (incl. the long-lived refresh token). */
export async function exchangeCode(code: string): Promise<TokenResponse> {
  const res = await fetch(`${ebayHosts().api}/identity/v1/oauth2/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Authorization: basicAuthHeader() },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: process.env.EBAY_RU_NAME!,
    }),
  });
  if (!res.ok) throw new Error(`eBay token exchange failed: ${res.status} ${await res.text()}`);
  return res.json();
}

/** Trade a stored refresh token for a fresh access token (scoped to selling). */
export async function accessTokenFromRefresh(refreshToken: string): Promise<string> {
  const res = await fetch(`${ebayHosts().api}/identity/v1/oauth2/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Authorization: basicAuthHeader() },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      scope: SCOPES.join(' '),
    }),
  });
  if (!res.ok) throw new Error(`eBay refresh failed: ${res.status} ${await res.text()}`);
  const data = (await res.json()) as TokenResponse;
  return data.access_token;
}
