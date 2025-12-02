// /api/email-proxy.js
// This runs as a serverless function on Vercel

import nodemailer from 'nodemailer';
import logger from '../../utils/logger';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Add CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    // Get email configuration from server environment (no VITE_ prefix)
    const smtpConfig = {
      host: process.env.SMTP_HOST,
      port: process.env.SMTP_PORT || 587,
      secure: false,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASSWORD
      }
    };

    // Validate configuration
    if (!smtpConfig.host || !smtpConfig.auth.user || !smtpConfig.auth.pass) {
      return res.status(500).json({ error: 'SMTP configuration missing' });
    }

    // Get email data from request
    const { to, subject, html, text, from } = req.body;

    if (!to || !subject || (!html && !text)) {
      return res.status(400).json({ error: 'Missing required email fields' });
    }

    // Create transporter
    const transporter = nodemailer.createTransporter(smtpConfig);

    // Send email
    const info = await transporter.sendMail({
      from: from || {
        name: process.env.FROM_NAME || 'PowerCowo',
        address: process.env.FROM_EMAIL || smtpConfig.auth.user
      },
      to: to,
      subject: subject,
      html: html,
      text: text
    });

    logger.log('Email sent:', info.messageId);
    
    return res.status(200).json({ 
      success: true, 
      messageId: info.messageId 
    });

  } catch (error) {
    logger.error('Email proxy error:', error);
    return res.status(500).json({ 
      error: 'Failed to send email',
      message: error.message 
    });
  }
}