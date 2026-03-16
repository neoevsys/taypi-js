# TAYPI JS SDK

SDK oficial para integrar pagos QR de [TAYPI](https://taypi.pe) en aplicaciones Node.js y Next.js.

Acepta pagos con Yape, Plin y cualquier app bancaria conectada a la CCE.

## Requisitos

- Node.js 16 o superior

## Instalación

```bash
npm install taypi.pe
```

## Uso rápido

```typescript
import { Taypi } from 'taypi.pe';

const taypi = new Taypi(
    'taypi_pk_test_...',  // Public key
    'taypi_sk_test_...',  // Secret key
);

// Crear sesión de checkout
const session = await taypi.createCheckoutSession({
    amount: '25.00',
    reference: 'ORD-12345',
    description: 'Zapatillas Nike Air',
}, 'ORD-12345'); // Idempotency-Key

console.log(session.checkout_token);
```

### Next.js (API Route + checkout.js)

**`app/api/checkout/route.ts`** — Backend (servidor)

```typescript
import { Taypi } from 'taypi.pe';
import { NextResponse } from 'next/server';

const taypi = new Taypi(
    process.env.TAYPI_PUBLIC_KEY!,
    process.env.TAYPI_SECRET_KEY!,
);

export async function POST(request: Request) {
    const { amount, reference, description } = await request.json();

    const session = await taypi.createCheckoutSession(
        { amount, reference, description },
        reference,
    );

    return NextResponse.json({
        checkoutToken: session.checkout_token,
        publicKey: taypi.publicKey,
    });
}
```

**`app/checkout/page.tsx`** — Frontend (cliente)

```tsx
'use client';
import Script from 'next/script';

export default function CheckoutPage() {
    async function handlePay() {
        const res = await fetch('/api/checkout', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                amount: '25.00',
                reference: 'ORD-12345',
                description: 'Zapatillas Nike Air',
            }),
        });

        const { checkoutToken, publicKey } = await res.json();

        window.Taypi.publicKey = publicKey;
        window.Taypi.open({
            sessionToken: checkoutToken,
            onSuccess: (result) => alert('Pago completado: ' + result.paid_at),
            onExpired: () => alert('QR expirado'),
            onClose: () => console.log('Modal cerrado'),
        });
    }

    return (
        <>
            <Script src="https://app.taypi.pe/v1/checkout.js" />
            <button onClick={handlePay}>Pagar con QR</button>
        </>
    );
}
```

## Métodos disponibles

### Checkout Sessions

```typescript
// Crear sesión para checkout.js (retorna solo checkout_token)
const session = await taypi.createCheckoutSession({
    amount: '50.00',
    reference: 'ORD-789',
    description: 'Descripción del pago',
    metadata: { source: 'web' },
}, 'ORD-789');
```

### Pagos

```typescript
// Crear pago (retorna datos completos: QR, checkout_url, etc.)
const payment = await taypi.createPayment({
    amount: '50.00',
    reference: 'ORD-789',
    description: 'Descripción del pago',
}, 'ORD-789');

// Consultar pago
const payment = await taypi.getPayment('uuid-del-pago');

// Listar pagos
const result = await taypi.listPayments({
    status: 'completed',
    from: '2026-03-01',
    to: '2026-03-31',
    per_page: 50,
});

// Cancelar pago pendiente
const cancelled = await taypi.cancelPayment('uuid-del-pago', 'cancel-ORD-789');
```

### Webhooks

```typescript
import express from 'express';

// IMPORTANTE: usar express.raw() para verificar la firma sobre el body crudo
app.post('/webhooks/taypi', express.raw({ type: 'application/json' }), (req, res) => {
    const payload = req.body.toString('utf-8');
    const signature = req.headers['taypi-signature'] as string;

    if (taypi.verifyWebhook(payload, signature, 'tu_webhook_secret')) {
        const event = JSON.parse(payload);
        // Webhook válido, procesar
    } else {
        res.status(403).json({ error: 'Firma inválida' });
    }
});
```

## Entornos

```typescript
// Producción (default)
const taypi = new Taypi('pk', 'sk');

// Sandbox (pruebas)
const taypi = new Taypi('pk', 'sk', { baseUrl: 'https://sandbox.taypi.pe' });
```

## Idempotencia

Todos los métodos que crean recursos (`createCheckoutSession`, `createPayment`, `cancelPayment`) requieren un `idempotencyKey` explícito. Esto protege contra pagos duplicados por reintentos de red.

```typescript
// Usar la referencia de orden como idempotency key
await taypi.createCheckoutSession(params, 'ORD-12345');

// Si el mismo key se envía dentro de los 15 minutos, retorna la respuesta cacheada
// sin crear un pago nuevo.
```

## Manejo de errores

```typescript
import { Taypi, TaypiError } from 'taypi.pe';

try {
    const session = await taypi.createCheckoutSession(params, reference);
} catch (err) {
    if (err instanceof TaypiError) {
        console.log(err.message);    // "El monto mínimo es S/ 1.00"
        console.log(err.errorCode);  // "AMOUNT_TOO_LOW"
        console.log(err.httpCode);   // 422
        console.log(err.response);   // Respuesta completa del API (object)
    }
}
```

## Licencia

MIT - [NEO TECHNOLOGY PERÚ E.I.R.L.](https://neotecperu.com)
