import { createHmac, timingSafeEqual } from 'crypto';
import https from 'https';
import http from 'http';
import { URL } from 'url';
import { TaypiError } from './TaypiError';

export interface TaypiOptions {
    baseUrl?: string;
    timeout?: number;
}

export interface CheckoutSessionParams {
    amount: string;
    reference: string;
    description?: string;
    metadata?: Record<string, unknown>;
}

export interface PaymentParams {
    amount: string;
    reference: string;
    description?: string;
    metadata?: Record<string, unknown>;
}

export interface ListPaymentsFilters {
    status?: string;
    reference?: string;
    from?: string;
    to?: string;
    per_page?: number;
    page?: number;
}

const VERSION = '1.0.0';

const ENVIRONMENTS = [
    'https://app.taypi.pe',
    'https://sandbox.taypi.pe',
];

export class Taypi {
    public readonly publicKey: string;
    /** Indica si el cliente está en modo sandbox (true) o producción (false). */
    public readonly isSandbox: boolean;
    private readonly secretKey: string;
    private readonly baseUrl: string;
    private readonly timeout: number;

    constructor(publicKey: string, secretKey: string, options: TaypiOptions = {}) {
        // ── Validar formato de API keys ──
        Taypi.validateKeyFormat(publicKey, 'publicKey', 'taypi_pk_', 32);
        Taypi.validateKeyFormat(secretKey, 'secretKey', 'taypi_sk_', 64);

        const publicIsTest = publicKey.startsWith('taypi_pk_test_');
        const secretIsTest = secretKey.startsWith('taypi_sk_test_');

        if (publicIsTest !== secretIsTest) {
            throw new TaypiError(
                'Las keys no coinciden: una es de test y otra de producción. '
                + 'Ambas deben ser del mismo ambiente (taypi_pk_test_ + taypi_sk_test_ o taypi_pk_live_ + taypi_sk_live_).',
                'KEY_ENVIRONMENT_MISMATCH',
            );
        }

        const isTestMode = publicIsTest;

        this.publicKey = publicKey;
        this.secretKey = secretKey;
        this.timeout = options.timeout ?? 15;

        if (options.baseUrl) {
            const url = options.baseUrl.replace(/\/+$/, '').replace(/\/v1$/, '');
            if (!ENVIRONMENTS.includes(url)) {
                throw new TaypiError(
                    'URL no permitida. Usa: https://app.taypi.pe (producción) o https://sandbox.taypi.pe (sandbox).',
                    'INVALID_BASE_URL',
                );
            }

            // ── Validar consistencia key ↔ ambiente ──
            const urlIsSandbox = url === ENVIRONMENTS[1];
            if (isTestMode && !urlIsSandbox) {
                throw new TaypiError(
                    'Keys de test (taypi_pk_test_) solo funcionan con sandbox. '
                    + 'Usa baseUrl: "https://sandbox.taypi.pe" o cambia a keys de producción (taypi_pk_live_).',
                    'KEY_URL_MISMATCH',
                );
            }
            if (!isTestMode && urlIsSandbox) {
                throw new TaypiError(
                    'Keys de producción (taypi_pk_live_) solo funcionan con producción. '
                    + 'Usa baseUrl: "https://app.taypi.pe" o cambia a keys de test (taypi_pk_test_).',
                    'KEY_URL_MISMATCH',
                );
            }

            this.baseUrl = url;
        } else {
            // ── Auto-detectar ambiente desde el key ──
            this.baseUrl = isTestMode ? ENVIRONMENTS[1] : ENVIRONMENTS[0];
        }

        this.isSandbox = isTestMode;
    }

    private static validateKeyFormat(key: string, paramName: string, expectedPrefix: string, expectedTokenLength: number): void {
        if (!key || !key.startsWith(expectedPrefix)) {
            throw new TaypiError(
                `Formato de ${paramName} inválido. Debe iniciar con "${expectedPrefix}live_" o "${expectedPrefix}test_". Recibido: "${key?.substring(0, 20)}..."`,
                'INVALID_KEY_FORMAT',
            );
        }

        const afterPrefix = key.substring(expectedPrefix.length);
        if (!afterPrefix.startsWith('live_') && !afterPrefix.startsWith('test_')) {
            throw new TaypiError(
                `Formato de ${paramName} inválido. Después de "${expectedPrefix}" debe seguir "live_" o "test_".`,
                'INVALID_KEY_FORMAT',
            );
        }

        const fullPrefix = expectedPrefix + (afterPrefix.startsWith('live_') ? 'live_' : 'test_');
        const token = key.substring(fullPrefix.length);
        if (token.length !== expectedTokenLength) {
            throw new TaypiError(
                `Longitud de ${paramName} inválida. Se esperan ${expectedTokenLength} caracteres después de "${fullPrefix}", se recibieron ${token.length}.`,
                'INVALID_KEY_FORMAT',
            );
        }
    }

    // ─── Checkout Sessions ───────────────────────────────────

    async createCheckoutSession(
        params: CheckoutSessionParams,
        idempotencyKey: string,
    ): Promise<{ checkout_token: string }> {
        const response = await this.post('/v1/checkout/sessions', params as unknown as Record<string, unknown>, idempotencyKey);
        return response.data as { checkout_token: string };
    }

    // ─── Payments ────────────────────────────────────────────

    async createPayment(
        params: PaymentParams,
        idempotencyKey: string,
    ): Promise<Record<string, unknown>> {
        const response = await this.post('/api/v1/payments', params as unknown as Record<string, unknown>, idempotencyKey);
        return response.data as Record<string, unknown>;
    }

    async getPayment(paymentId: string): Promise<Record<string, unknown>> {
        const response = await this.get(`/api/v1/payments/${paymentId}`);
        return response.data as Record<string, unknown>;
    }

    async listPayments(filters: ListPaymentsFilters = {}): Promise<Record<string, unknown>> {
        const query = Object.entries(filters)
            .filter(([, v]) => v !== undefined)
            .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
            .join('&');
        const path = query ? `/api/v1/payments?${query}` : '/api/v1/payments';
        return this.get(path);
    }

    async cancelPayment(
        paymentId: string,
        idempotencyKey: string,
    ): Promise<Record<string, unknown>> {
        const response = await this.post(`/api/v1/payments/${paymentId}/cancel`, {}, idempotencyKey);
        return response.data as Record<string, unknown>;
    }

    // ─── Webhooks ────────────────────────────────────────────

    verifyWebhook(payload: string, signature: string, webhookSecret: string): boolean {
        const expected = 'sha256=' + createHmac('sha256', webhookSecret).update(payload).digest('hex');

        try {
            return timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
        } catch {
            return false;
        }
    }

    // ─── HTTP ────────────────────────────────────────────────

    private async post(
        path: string,
        params: Record<string, unknown>,
        idempotencyKey: string,
    ): Promise<Record<string, unknown>> {
        return this.request('POST', path, params, idempotencyKey);
    }

    private async get(path: string): Promise<Record<string, unknown>> {
        return this.request('GET', path);
    }

    private request(
        method: string,
        path: string,
        params?: Record<string, unknown> | null,
        idempotencyKey?: string | null,
    ): Promise<Record<string, unknown>> {
        return new Promise((resolve, reject) => {
            const body = params ? JSON.stringify(params) : '';
            const timestamp = Math.floor(Date.now() / 1000).toString();

            const url = new URL(path, this.baseUrl);
            const isHttps = url.protocol === 'https:';
            const transport = isHttps ? https : http;

            // GET /v1/checkout/sessions/{token} no requiere firma HMAC (solo Bearer)
            const skipSignature = method === 'GET' && path.includes('/checkout/sessions/');

            const headers: Record<string, string> = {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                'Authorization': `Bearer ${this.publicKey}`,
                'User-Agent': `taypi-js/${VERSION}`,
            };

            if (!skipSignature) {
                const signaturePath = url.pathname;
                const message = `${timestamp}\n${method}\n${signaturePath}\n${body}`;
                const signature = createHmac('sha256', this.secretKey).update(message).digest('hex');
                headers['Taypi-Signature'] = signature;
                headers['Taypi-Timestamp'] = timestamp;
            }

            if (idempotencyKey) {
                headers['Idempotency-Key'] = idempotencyKey;
            }

            const options = {
                hostname: url.hostname,
                port: url.port || (isHttps ? 443 : 80),
                path: url.pathname + url.search,
                method,
                headers,
                timeout: this.timeout * 1000,
            };

            const req = transport.request(options, (res: http.IncomingMessage) => {
                const chunks: Buffer[] = [];

                res.on('data', (chunk: Buffer) => chunks.push(chunk));
                res.on('end', () => {
                    const raw = Buffer.concat(chunks).toString('utf-8');
                    const httpCode = res.statusCode ?? 0;

                    let data: Record<string, unknown>;
                    try {
                        data = JSON.parse(raw);
                    } catch {
                        reject(new TaypiError(
                            'Respuesta inválida del servidor',
                            'INVALID_RESPONSE',
                            httpCode,
                        ));
                        return;
                    }

                    if (httpCode >= 400) {
                        reject(new TaypiError(
                            (data.message as string) ?? 'Error del API',
                            (data.error as string) ?? 'API_ERROR',
                            httpCode,
                            data,
                        ));
                        return;
                    }

                    resolve(data);
                });
            });

            req.on('error', (err: Error) => {
                reject(new TaypiError(
                    `Error de conexión: ${err.message}`,
                    'CONNECTION_ERROR',
                    0,
                ));
            });

            req.on('timeout', () => {
                req.destroy();
                reject(new TaypiError(
                    'Timeout de conexión',
                    'TIMEOUT',
                    0,
                ));
            });

            if (method === 'POST' && body) {
                req.write(body);
            }

            req.end();
        });
    }
}
