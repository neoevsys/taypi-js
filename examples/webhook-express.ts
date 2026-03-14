/**
 * TAYPI Webhook — Ejemplo con Express
 *
 * Requisitos:
 *   npm install taypi express
 *
 * IMPORTANTE: Usa express.raw() para recibir el body sin parsear.
 * La firma se calcula sobre el body crudo, no sobre el JSON parseado.
 */

import express from 'express';
import { Taypi } from 'taypi';

const app = express();
const taypi = new Taypi(
    process.env.TAYPI_PUBLIC_KEY!,
    process.env.TAYPI_SECRET_KEY!,
);

const WEBHOOK_SECRET = process.env.TAYPI_WEBHOOK_SECRET!;

// IMPORTANTE: raw body para verificar firma
app.post('/webhooks/taypi', express.raw({ type: 'application/json' }), (req, res) => {
    const payload = req.body.toString('utf-8');
    const signature = req.headers['taypi-signature'] as string;

    if (!taypi.verifyWebhook(payload, signature, WEBHOOK_SECRET)) {
        res.status(403).json({ error: 'Firma inválida' });
        return;
    }

    const event = JSON.parse(payload);

    switch (event.event) {
        case 'payment.completed':
            console.log(`Pago completado: ${event.payment_id} - S/ ${event.amount}`);
            // Actualizar orden en tu base de datos
            break;

        case 'payment.expired':
            console.log(`Pago expirado: ${event.reference}`);
            // Liberar stock reservado
            break;

        default:
            console.log(`Evento desconocido: ${event.event}`);
    }

    res.json({ received: true });
});

app.listen(3000, () => console.log('Webhook listener en http://localhost:3000'));
