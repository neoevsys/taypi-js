export class TaypiError extends Error {
    /** Código de error TAYPI (ej: AMOUNT_TOO_LOW, RATE_LIMIT_EXCEEDED) */
    public readonly errorCode: string;

    /** HTTP status code (0 si es error de conexión) */
    public readonly httpCode: number;

    /** Respuesta completa del API */
    public readonly response: Record<string, unknown> | null;

    constructor(
        message: string,
        errorCode: string = 'UNKNOWN',
        httpCode: number = 0,
        response: Record<string, unknown> | null = null,
    ) {
        super(message);
        this.name = 'TaypiError';
        this.errorCode = errorCode;
        this.httpCode = httpCode;
        this.response = response;
    }
}
