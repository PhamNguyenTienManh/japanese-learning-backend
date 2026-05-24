import * as crypto from 'crypto';

export interface BuildZalopayCreateBodyOptions {
  appId: string;
  key1: string;
  appTransId: string;
  appUser: string;
  appTime: number;
  amount: number;
  item: string;
  embedData: string;
  description: string;
  bankCode?: string;
  callbackUrl?: string;
}

export interface BuildZalopayQueryBodyOptions {
  appId: string;
  key1: string;
  appTransId: string;
}

function hmacSha256(secret: string, data: string): string {
  return crypto.createHmac('sha256', secret).update(data, 'utf-8').digest('hex');
}

export function buildZalopayAppTransId(
  orderId: string,
  date: Date = new Date(),
): string {
  const vnDate = new Date(date.getTime() + 7 * 60 * 60 * 1000);
  const yy = String(vnDate.getUTCFullYear()).slice(-2);
  const mm = String(vnDate.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(vnDate.getUTCDate()).padStart(2, '0');
  return `${yy}${mm}${dd}_${orderId}`;
}

export function extractOrderIdFromZalopayAppTransId(appTransId: string): string {
  const [, orderId = ''] = String(appTransId || '').split('_');
  return orderId;
}

export function buildZalopayCreateBody(opts: BuildZalopayCreateBodyOptions) {
  const body: Record<string, string | number> = {
    app_id: opts.appId,
    app_user: opts.appUser,
    app_time: opts.appTime,
    amount: opts.amount,
    app_trans_id: opts.appTransId,
    embed_data: opts.embedData,
    item: opts.item,
    description: opts.description,
    bank_code: opts.bankCode ?? '',
  };

  if (opts.callbackUrl) {
    body.callback_url = opts.callbackUrl;
  }

  const macInput = [
    opts.appId,
    opts.appTransId,
    opts.appUser,
    opts.amount,
    opts.appTime,
    opts.embedData,
    opts.item,
  ].join('|');

  body.mac = hmacSha256(opts.key1, macInput);
  return body;
}

export function buildZalopayQueryBody(opts: BuildZalopayQueryBodyOptions) {
  const macInput = `${opts.appId}|${opts.appTransId}|${opts.key1}`;
  return {
    app_id: opts.appId,
    app_trans_id: opts.appTransId,
    mac: hmacSha256(opts.key1, macInput),
  };
}

export function verifyZalopayCallback(
  body: Record<string, any>,
  key2: string,
): boolean {
  const data = String(body.data || '');
  const provided = String(body.mac || '');
  if (!data || !provided) return false;

  const computed = hmacSha256(key2, data);
  return computed.toLowerCase() === provided.toLowerCase();
}

export function parseZalopayCallbackData(body: Record<string, any>) {
  const data = body.data;
  if (typeof data === 'object' && data !== null) return data;
  return JSON.parse(String(data || '{}'));
}

export function verifyZalopayRedirect(
  query: Record<string, any>,
  key2: string,
): boolean {
  const provided = String(query.checksum || '');
  if (!provided) return false;

  const checksumInput = [
    query.appid ?? '',
    query.apptransid ?? '',
    query.pmcid ?? '',
    query.bankcode ?? '',
    query.amount ?? '',
    query.discountamount ?? '',
    query.status ?? '',
  ].join('|');

  const computed = hmacSha256(key2, checksumInput);
  return computed.toLowerCase() === provided.toLowerCase();
}

export function getClientIp(req: any): string {
  const fwd = req.headers?.['x-forwarded-for'];
  const raw =
    (typeof fwd === 'string' ? fwd.split(',')[0].trim() : '') ||
    req.ip ||
    req.connection?.remoteAddress ||
    req.socket?.remoteAddress ||
    '127.0.0.1';
  return raw.replace(/^::ffff:/, '');
}
