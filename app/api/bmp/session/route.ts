import { NextRequest, NextResponse } from 'next/server';
import { bmpConfig } from '@/lib/integrations/config';
import { BMP_IDENTITY_COOKIE, BMP_SESSION_COOKIE, encodeBmpIdentity, getBmpSessionIdentity, getBmpSessionToken } from '@/lib/security/bmp-session';

type LoginPayload = { name?: unknown; email?: unknown; password?: unknown };
type BmpLoginResponse = Record<string, unknown> & { data?: Record<string, unknown>; user?: Record<string, unknown> };

export async function GET() {
  const [token, identity] = await Promise.all([getBmpSessionToken(), getBmpSessionIdentity()]);
  return NextResponse.json(
    { authenticated: Boolean(token && identity), identity: token && identity ? identity : null },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}

export async function POST(request: NextRequest) {
  if (!sameOrigin(request)) return NextResponse.json({ error: '登录请求来源无效。' }, { status: 403 });
  const body = await request.json().catch(() => ({})) as LoginPayload;
  const name = clean(body.name, 80);
  const email = clean(body.email, 160).toLowerCase();
  const password = typeof body.password === 'string' ? body.password : '';
  if (!name || !validEmail(email) || password.length < 6 || password.length > 256) {
    return NextResponse.json({ error: '请完整填写姓名、BMP 邮箱账号和密码。' }, { status: 400 });
  }

  const config = bmpConfig();
  if (!config.baseUrl) return NextResponse.json({ error: 'BMP 登录接口尚未配置，请联系 IT。' }, { status: 503 });

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15_000);
    let bmpResponse: Response;
    try {
      bmpResponse = await fetch(`${config.baseUrl}${config.authPath}`, {
        method: 'POST',
        headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: email, email, password }),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeout);
    }

    const result = await bmpResponse.json().catch(() => ({})) as BmpLoginResponse;
    if (!bmpResponse.ok) return NextResponse.json({ error: 'BMP 邮箱账号或密码不正确。' }, { status: 401 });
    const token = pickString(result, ['accessToken', 'access_token', 'token']) || pickString(result.data, ['accessToken', 'access_token', 'token']);
    if (!token) return NextResponse.json({ error: 'BMP 登录成功但未返回访问令牌，请 IT 核对接口字段。' }, { status: 502 });

    const user = result.user || (result.data?.user as Record<string, unknown> | undefined) || {};
    const bmpEmail = pickString(user, ['email', 'username']) || email;
    const bmpName = pickString(user, ['displayName', 'fullName', 'name']) || name;
    const bmpUserId = pickString(user, ['id', 'userId', 'externalId']) || `bmp:${bmpEmail.toLowerCase()}`;
    const expiresIn = boundedExpiry(result.expiresIn ?? result.expires_in ?? result.data?.expiresIn ?? result.data?.expires_in);
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
  const response = NextResponse.json({ authenticated: false });
  response.cookies.set(BMP_SESSION_COOKIE, '', { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/', maxAge: 0 });
  response.cookies.set(BMP_IDENTITY_COOKIE, '', { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/', maxAge: 0 });
  response.headers.set('Cache-Control', 'no-store');
  return response;
}

function pickString(value: Record<string, unknown> | undefined, keys: string[]) {
  if (!value) return '';
  for (const key of keys) {
    const candidate = value[key];
    if (typeof candidate === 'string' && candidate.trim()) return candidate.trim();
    if (typeof candidate === 'number' && Number.isFinite(candidate)) return String(candidate);
  }
  return '';
}

function boundedExpiry(value: unknown) {
  const seconds = Number(value);
  if (!Number.isFinite(seconds)) return 8 * 60 * 60;
  return Math.min(12 * 60 * 60, Math.max(15 * 60, Math.round(seconds)));
}

function sameOrigin(request: NextRequest) {
  const origin = request.headers.get('origin');
  return !origin || origin === request.nextUrl.origin;
}

function validEmail(value: string) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value); }
function clean(value: unknown, maxLength: number) { return typeof value === 'string' ? value.trim().slice(0, maxLength) : ''; }

