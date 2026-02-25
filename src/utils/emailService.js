// src/utils/emailService.js
const SEND_EMAIL_URL = '/.netlify/functions/send-email';

export class EmailService {
  async _send(type, data) {
    const response = await fetch(SEND_EMAIL_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type, ...data }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
    }

    return response.json();
  }

  async sendContactForm(formData) {
    try {
      return await this._send('contact', {
        name: formData.name,
        email: formData.email,
        message: formData.message,
      });
    } catch (error) {
      console.error('Error sending contact form:', error);
      throw error;
    }
  }

  async sendROILead(leadData) {
    try {
      return await this._send('roi-lead', {
        name: leadData.name,
        email: leadData.email,
        phone: leadData.phone || '',
        company: leadData.company || '',
        calculationResults: leadData.calculationResults || {},
      });
    } catch (error) {
      console.error('Error sending ROI lead:', error);
      throw error;
    }
  }

  async sendWebLead(leadData) {
    try {
      return await this._send('web-lead', {
        name: leadData.name,
        email: leadData.email,
        phone: leadData.phone || '',
        calculationResults: leadData.calculationResults || {},
      });
    } catch (error) {
      console.error('Error sending web lead:', error);
      throw error;
    }
  }

  async sendChatbotLead(leadData) {
    try {
      return await this._send('chatbot-lead', {
        name: leadData.name,
        email: leadData.email,
        phone: leadData.phone || '',
        message: leadData.message || '',
      });
    } catch (error) {
      console.error('Error sending chatbot lead:', error);
      throw error;
    }
  }
}

export const emailService = new EmailService();
