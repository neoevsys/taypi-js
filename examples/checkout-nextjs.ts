/**
 * TAYPI + Next.js — Ejemplo de Checkout
 *
 * Este ejemplo muestra cómo integrar TAYPI en una app Next.js:
 *   1. El backend (API Route) crea la sesión con el SDK
 *   2. El frontend recibe solo el checkout_token
 *   3. checkout.js abre el modal de pago
 *
 * Archivos:
 *   app/api/checkout/route.ts  → API Route (backend)
 *   app/checkout/page.tsx      → Página de checkout (frontend)
 */

// ─── app/api/checkout/route.ts ────────────────────────────
// API Route — se ejecuta en el servidor, las keys nunca llegan al cliente

import { Taypi } from 'taypi';
import { NextResponse } from 'next/server';

const taypi = new Taypi(
    process.env.TAYPI_PUBLIC_KEY!,
    process.env.TAYPI_SECRET_KEY!,
    { baseUrl: process.env.TAYPI_BASE_URL }, // https://sandbox.taypi.pe
);

export async function POST(request: Request) {
    const { amount, reference, description } = await request.json();

    const session = await taypi.createCheckoutSession(
        { amount, reference, description },
        reference, // Idempotency-Key = referencia de la orden
    );

    return NextResponse.json({
        checkoutToken: session.checkout_token,
        publicKey: taypi.publicKey,
    });
}


// ─── app/checkout/page.tsx ────────────────────────────────
// Página del cliente — solo recibe el token, nunca las keys

/*
'use client';
import { useEffect } from 'react';
import Script from 'next/script';

declare global {
    interface Window {
        Taypi: {
            publicKey: string;
            open: (options: {
                sessionToken: string;
                onSuccess?: (result: { paid_at: string }) => void;
                onExpired?: () => void;
                onClose?: () => void;
            }) => void;
        };
    }
}

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
            onSuccess: (result) => {
                alert('Pago completado: ' + result.paid_at);
            },
            onExpired: () => {
                alert('QR expirado');
            },
            onClose: () => {
                console.log('Modal cerrado');
            },
        });
    }

    return (
        <>
            <Script src="https://app.taypi.pe/v1/checkout.js" />
            <button onClick={handlePay}>Pagar con QR</button>
        </>
    );
}
*/
