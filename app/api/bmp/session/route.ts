import { NextRequest, NextResponse } from 'next/server';
import { env } from 'cloudflare:workers';
import { bmpConfig } from '@/lib/integrations/config';
import { BMP_IDENTITY_COOKIE, BMP_SESSION_COOKIE, bmpTokenHash, encodeBmpIdentity, getBmpSessionIdentity, getBmpSessionToken } from '@/lib/security/bmp-session';

type LoginPayload = { name?: unknown; email?: unknown; password?: unknown };
type BmpLoginResponseV1 = {
  contractVersion: string;
  accessToken: string;
  expiresIn: number;
  user: { id: string; email: string; displayName: string };
};

const supportedAuthContract = 'yikon-bmp-auth-v1';

export async function GET() {
  const [token, identity] = await Promise.all([getBmpSessionToken(), getBmpSessionIdentity()]);
  const config = bmpConfig();
  return NextResponse.json(
    { authenticated: Boolean(token && identity), identity: token && identity ? identity : null, contractVerified: authContractReady(config), contractVersion: config.authContractVersion || null, supportedContractVersion: supportedAuthContract },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}

export async function POST(request: NextRequest) {
  if (!sameOrigin(request)) return NextResponse.json({ error: '登录请求来源无效。' }, { status: 403 });
  const config = bmpConfig();
  if (!authContractReady(config)) return NextResponse.json({ error: 'BMP身份认证契约尚未经IT验收，平台不接收BMP密码。' }, { status: 501 });
  const body = await request.json().catch(() => ({})) as LoginPayload;
  const name = clean(body.name, 80);
  const email = clean(body.email, 160).toLowerCase();
  const password = typeof body.password === 'string' ? body.password : '';
  if (!name || !validEmail(email) || password.length < 6 || password.length > 256) {
    return NextResponse.json({ error: '请完整填写姓名、BMP 邮箱账号和密码。' }, { status: 400 });
  }

  if (!config.baseUrl || !config.authPath) return NextResponse.json({ error: 'BMP 登录地址或认证路径尚未由 IT 配置。' }, { status: 503 });

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15_000);
    let bmpResponse: Response;
    try {
      bmpResponse = await fetch(`${config.baseUrl}${config.authPath}`, {
        method: 'POST',
        headers: { Accept: 'application/json', 'Content-Type': 'application/json', 'X-BMP-Contract-Version': supportedAuthContract },
        body: JSON.stringify({ contractVersion: supportedAuthContract, email, password }),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeout);
    }

    const result = await bmpResponse.json().catch(() => null) as unknown;
    if (!bmpResponse.ok) return NextResponse.json({ error: 'BMP 邮箱账号或密码不正确。' }, { status: 401 });
    const accepted = acceptAuthResponse(result, email);
    if (!accepted) return NextResponse.json({ error: `BMP认证响应不符合已验收契约 ${supportedAuthContract}，未建立平台会话。` }, { status: 502 });
    const { accessToken: token, expiresIn, user } = accepted;
    const bmpEmail = user.email.toLowerCase(), bmpName = user.displayName, bmpUserId = user.id;
    await env.DB.prepare('INSERT INTO platform_sessions (token_hash, identity_json, expires_at) VALUES (?, ?, ?) ON CONFLICT(token_hash) DO UPDATE SET identity_json = excluded.identity_json, expires_at = excluded.expires_at').bind(await bmpTokenHash(token), JSON.stringify({ userId: bmpUserId, name: bmpName, email: bmpEmail }), Date.now() + expiresIn * 1000).run();
    const response = NextResponse.json({ authenticated: true, identity: { userId: bmpUserId, name: bmpName, email: bmpEmail } });
    const cookieOptions = { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax' as const, path: '/', maxAge: expiresIn };
    response.cookies.set(BMP_SESSION_COOKIE, token, cookieOptions);
    response.cookies.set(BMP_IDENTITY_COOKIE, encodeBmpIdentity({ userId: bmpUserId, name: bmpName, email: bmpEmail }), cookieOptions);
    response.headers.set('Cache-Control', 'no-store');
    return response;
  } catch {
    return NextResponse.json({ error: 'BMP 登录服务暂时不可用，请稍后重试。' }, { status: 502 });
  }
}

export async function DELETE(request: NextRequest) {
  if (!sameOrigin(request)) return NextResponse.json({ error: '退出请求来源无效。' }, { status: 403 });
  const token = await getBmpSessionToken();
  if (token) await env.DB.prepare('DELETE FROM platform_sessions WHERE token_hash = ?').bind(await bmpTokenHash(token)).run();
  const response = NextResponse.json({ authenticated: false });
  response.cookies.set(BMP_SESSION_COOKIE, '', { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/', maxAge: 0 });
  response.cookies.set(BMP_IDENTITY_COOKIE, '', { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/', maxAge: 0 });
  response.headers.set('Cache-Control', 'no-store');
  return response;
}

function acceptAuthResponse(value: unknown, requestedEmail: string): BmpLoginResponseV1 | null {
  if (!value || typeof value !== 'object') return null;
  const candidate = value as Partial<BmpLoginResponseV1>;
  if (candidate.contractVersion !== supportedAuthContract || typeof candidate.accessToken !== 'string' || candidate.accessToken.length < 16 || candidate.accessToken.length > 3000) return null;
  if (!Number.isInteger(candidate.expiresIn) || Number(candidate.expiresIn) < 15 * 60 || Number(candidate.expiresIn) > 12 * 60 * 60) return null;
  const user = candidate.user;
  if (!user || typeof user.id !== 'string' || !user.id.trim() || user.id.length > 160 || typeof user.email !== 'string' || !validEmail(user.email) || user.email.toLowerCase() !== requestedEmail || typeof user.displayName !== 'string' || !user.displayName.trim() || user.displayName.length > 80) return null;
  return { contractVersion: candidate.contractVersion, accessToken: candidate.accessToken, expiresIn: Number(candidate.expiresIn), user: { id: user.id.trim(), email: user.email.toLowerCase(), displayName: user.displayName.trim() } };
}

function sameOrigin(request: NextRequest) {
  const origin = request.headers.get('origin');
  return !origin || origin === request.nextUrl.origin;
}

function authContractReady(config: ReturnType<typeof bmpConfig>) {
  return config.authContractVerified && Boolean(config.authPath) && config.authContractVersion === supportedAuthContract;
}

function validEmail(value: string) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value); }
function clean(value: unknown, maxLength: number) { return typeof value === 'string' ? value.trim().slice(0, maxLength) : ''; }
