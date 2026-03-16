/**
 * TAYPI Pagos — Ejemplo de gestión directa
 *
 * Requisitos:
 *   npm install taypi
 *
 * Este ejemplo muestra cómo crear, consultar, listar y cancelar pagos
 * directamente desde el backend sin usar checkout.js.
 */

import { Taypi, TaypiError } from 'taypi';

const taypi = new Taypi(
    'taypi_pk_test_TU_PUBLIC_KEY',
    'taypi_sk_test_TU_SECRET_KEY',
    { baseUrl: 'https://sandbox.taypi.pe' },
);

async function main() {
    // ─── 1. Crear pago (retorna QR completo) ─────────────────
    try {
        const payment = await taypi.createPayment({
            amount: '50.00',
            reference: 'ORD-789',
            description: 'Curso de programación Node.js',
            metadata: { course_id: 42, student: 'Juan Pérez' },
        }, 'ORD-789'); // Idempotency-Key

        console.log('Pago creado:');
        console.log(`  ID:           ${payment.payment_id}`);
        console.log(`  QR Code:      ${payment.qr_code}`);
        console.log(`  Checkout URL: ${payment.checkout_url}`);
        console.log(`  Expira:       ${payment.expires_at}\n`);

        // ─── 2. Consultar pago por ID ─────────────────────────
        const consulta = await taypi.getPayment(payment.payment_id as string);
        console.log('Consulta de pago:');
        console.log(`  Status:    ${consulta.status}`);
        console.log(`  Amount:    S/ ${consulta.amount}`);
        console.log(`  Reference: ${consulta.reference}\n`);

        // ─── 3. Cancelar pago pendiente ───────────────────────
        const cancelado = await taypi.cancelPayment(
            payment.payment_id as string,
            'cancel-ORD-789',
        );
        console.log(`Pago cancelado: ${cancelado.status}\n`);
    } catch (err) {
        if (err instanceof TaypiError) {
            console.error(`Error: ${err.message} (${err.errorCode}) HTTP ${err.httpCode}`);
        } else {
            throw err;
        }
    }

    // ─── 4. Listar pagos con filtros ──────────────────────────
    try {
        const lista = await taypi.listPayments({
            status: 'completed',
            from: '2026-03-01',
            to: '2026-03-31',
            per_page: 10,
        }) as { data: Array<Record<string, unknown>>; meta: Record<string, unknown> };

        console.log('Pagos completados en marzo 2026:');
        for (const p of lista.data) {
            console.log(`  - ${p.reference}: S/ ${p.amount} (${p.paid_at})`);
        }
        console.log(`  Total: ${lista.meta.total} pagos`);
    } catch (err) {
        if (err instanceof TaypiError) {
            console.error(`Error listando: ${err.message}`);
        } else {
            throw err;
        }
    }
}

main();
