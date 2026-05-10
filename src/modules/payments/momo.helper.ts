import * as crypto from 'crypto';

/**
 * MoMo One-Time Payment (AIO) helper.
 * Spec: https://developers.momo.vn/v3/docs/payment/api/payment-method/onetime/
 *
 * MoMo signs a fixed-shape `key=value&key=value...` raw string with
 * HMAC-SHA256, NOT a URL-encoded query string. The order of keys is fixed
 * by the spec (alphabetical for the create request, fixed by spec for IPN).
 */

function hmacSha256(secret: string, data: string): string {
  return crypto.createHmac('sha256', secret).update(data, 'utf-8').digest('hex');
}

export interface BuildMomoCreateBodyOptions {
  partnerCode: string;
  accessKey: string;
  secretKey: string;
  requestId: string;
  orderId: string;
  amount: number; // VND, integer
  orderInfo: string;
  redirectUrl: string;
  ipnUrl: string;
  extraData?: string; // base64 string per spec, default ''
  requestType?: string; // default 'captureWallet'
  lang?: 'vi' | 'en';
}

export function buildMomoCreateBody(opts: BuildMomoCreateBodyOptions) {
  const requestType = opts.requestType || 'captureWallet';
  const extraData = opts.extraData ?? '';
  const lang = opts.lang || 'vi';

  // Signature raw string is fixed alphabetical key order per MoMo spec.
  const rawSignature =
    `accessKey=${opts.accessKey}` +
    `&amount=${opts.amount}` +
    `&extraData=${extraData}` +
    `&ipnUrl=${opts.ipnUrl}` +
    `&orderId=${opts.orderId}` +
    `&orderInfo=${opts.orderInfo}` +
    `&partnerCode=${opts.partnerCode}` +
    `&redirectUrl=${opts.redirectUrl}` +
    `&requestId=${opts.requestId}` +
    `&requestType=${requestType}`;

  const signature = hmacSha256(opts.secretKey, rawSignature);

  return {
    partnerCode: opts.partnerCode,
    partnerName: 'JLearn',
    storeId: 'JLearnStore',
    requestId: opts.requestId,
    amount: opts.amount,
    orderId: opts.orderId,
    orderInfo: opts.orderInfo,
    redirectUrl: opts.redirectUrl,
    ipnUrl: opts.ipnUrl,
    lang,
    extraData,
    requestType,
    signature,
  };
}

/**
 * Verify the signature on a MoMo redirect/IPN payload.
 * MoMo uses a strict, spec-defined order for the raw signature string here.
 */
export function verifyMomoSignature(
  body: Record<string, any>,
  accessKey: string,
  secretKey: string,
): boolean {
  const provided = String(body.signature || '');
  if (!provided) return false;

  const rawSignature =
    `accessKey=${accessKey}` +
    `&amount=${body.amount ?? ''}` +
    `&extraData=${body.extraData ?? ''}` +
    `&message=${body.message ?? ''}` +
    `&orderId=${body.orderId ?? ''}` +
    `&orderInfo=${body.orderInfo ?? ''}` +
    `&orderType=${body.orderType ?? ''}` +
    `&partnerCode=${body.partnerCode ?? ''}` +
    `&payType=${body.payType ?? ''}` +
    `&requestId=${body.requestId ?? ''}` +
    `&responseTime=${body.responseTime ?? ''}` +
    `&resultCode=${body.resultCode ?? ''}` +
    `&transId=${body.transId ?? ''}`;

  const computed = hmacSha256(secretKey, rawSignature);
  return computed.toLowerCase() === provided.toLowerCase();
}
