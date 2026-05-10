import * as crypto from 'crypto';

const VNP_VERSION = '2.1.0';
const VNP_COMMAND = 'pay';
const VNP_CURR_CODE = 'VND';
const VNP_LOCALE_DEFAULT = 'vn';
const VNP_ORDER_TYPE = 'other';

export interface BuildVnpayUrlParams {
  tmnCode: string;
  hashSecret: string;
  vnpUrl: string;
  returnUrl: string;
  amount: number; // VND, will be multiplied by 100 internally
  orderId: string;
  orderInfo: string;
  ipAddr: string;
  bankCode?: string;
  locale?: string;
  createDate?: Date;
}

/**
 * Encode a value the same way VNPay's official sample does:
 *   encodeURIComponent then replace %20 with +.
 * Keeping a single source of truth avoids signing/verification drift.
 */
function vnpEncode(value: string): string {
  return encodeURIComponent(value).replace(/%20/g, '+');
}

function sortAndEncode(
  params: Record<string, string | number>,
): Record<string, string> {
  const out: Record<string, string> = {};
  Object.keys(params)
    .sort()
    .forEach((k) => {
      out[k] = vnpEncode(String(params[k]));
    });
  return out;
}

function joinQuery(encoded: Record<string, string>): string {
  return Object.keys(encoded)
    .map((k) => `${k}=${encoded[k]}`)
    .join('&');
}

function hmacSha512(secret: string, data: string): string {
  return crypto
    .createHmac('sha512', secret)
    .update(Buffer.from(data, 'utf-8'))
    .digest('hex');
}

/** Format a Date as `yyyyMMddHHmmss` in GMT+7 (Asia/Ho_Chi_Minh). */
export function formatVnpDate(date: Date = new Date()): string {
  const vn = new Date(date.getTime() + 7 * 60 * 60 * 1000);
  const yyyy = vn.getUTCFullYear();
  const mm = String(vn.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(vn.getUTCDate()).padStart(2, '0');
  const HH = String(vn.getUTCHours()).padStart(2, '0');
  const MM = String(vn.getUTCMinutes()).padStart(2, '0');
  const SS = String(vn.getUTCSeconds()).padStart(2, '0');
  return `${yyyy}${mm}${dd}${HH}${MM}${SS}`;
}

export function buildVnpayPaymentUrl(opts: BuildVnpayUrlParams): string {
  const params: Record<string, string | number> = {
    vnp_Version: VNP_VERSION,
    vnp_Command: VNP_COMMAND,
    vnp_TmnCode: opts.tmnCode,
    vnp_Locale: opts.locale || VNP_LOCALE_DEFAULT,
    vnp_CurrCode: VNP_CURR_CODE,
    vnp_TxnRef: opts.orderId,
    vnp_OrderInfo: opts.orderInfo,
    vnp_OrderType: VNP_ORDER_TYPE,
    vnp_Amount: Math.round(opts.amount * 100),
    vnp_ReturnUrl: opts.returnUrl,
    vnp_IpAddr: opts.ipAddr,
    vnp_CreateDate: formatVnpDate(opts.createDate || new Date()),
  };

  if (opts.bankCode) {
    params.vnp_BankCode = opts.bankCode;
  }

  const sortedEncoded = sortAndEncode(params);
  const signData = joinQuery(sortedEncoded);
  const signature = hmacSha512(opts.hashSecret, signData);

  return `${opts.vnpUrl}?${signData}&vnp_SecureHash=${signature}`;
}

/**
 * Verify the secure hash returned by VNPay (return URL or IPN).
 * `query` should be the raw query object as parsed by Express
 * (already URL-decoded; we re-encode using the same rules to recompute).
 */
export function verifyVnpaySignature(
  query: Record<string, any>,
  hashSecret: string,
): boolean {
  const provided = String(query.vnp_SecureHash || '');
  if (!provided) return false;

  const filtered: Record<string, string | number> = {};
  for (const k of Object.keys(query)) {
    if (k === 'vnp_SecureHash' || k === 'vnp_SecureHashType') continue;
    filtered[k] = query[k];
  }

  const sortedEncoded = sortAndEncode(filtered);
  const signData = joinQuery(sortedEncoded);
  const computed = hmacSha512(hashSecret, signData);

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
