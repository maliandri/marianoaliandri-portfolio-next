// src/utils/exchangeService.js
// Servicio simple para obtener cotización ARS/USD desde Bluelytics
// y convertir montos en USD -> ARS. Incluye fallback por si falla.

export class ExchangeService {
  constructor() {
    this.rate = null;       // número (ARS por USD)
    this.rateDate = null;   // string con fecha de actualización
  }

  async getLatest() {
    // Si ya tenemos una cotización reciente en memoria, la usamos
    if (this.rate && this.rateDate && Date.now() - this.rateDate < 10 * 60 * 1000) {
      return { rate: this.rate, source: 'cache' };
    }

    try {
      const res = await fetch('https://api.bluelytics.com.ar/v2/latest', { cache: 'no-store' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();

      // Promedio compraventa dólar oficial (puedes cambiar a "blue" si lo preferís)
      const buy = Number(data?.oficial?.value_buy);
      const sell = Number(data?.oficial?.value_sell);
      const rate = Math.round((buy + sell) / 2);

      if (!Number.isFinite(rate) || rate <= 0) throw new Error('Cotización inválida');

      this.rate = rate;
      this.rateDate = Date.now();
      return { rate, source: 'bluelytics' };
    } catch (err) {
      // Fallback fijo para no romper la UI
      const fallback = 1050;
      this.rate = fallback;
      this.rateDate = Date.now();
      return { rate: fallback, source: 'fallback' };
    }
  }

  async convertUsdToArs(amountUsd) {
    const { rate } = await this.getLatest();
    const usd = Number(amountUsd) || 0;
    return Math.round(usd * rate);
  }

  // Método simplificado para obtener solo la cotización
  async getExchangeRate() {
    const { rate } = await this.getLatest();
    return rate;
  }
}

// helper de formateo
export const formatARS = (value) =>
  new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', minimumFractionDigits: 0 }).format(value);

export const formatUSD = (value) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0 }).format(value);
