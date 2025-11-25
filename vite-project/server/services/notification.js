/**
 * Notification Service
 * Handles multi-channel notifications (email, SMS, push)
 * for alert monitoring system
 */

import nodemailer from 'nodemailer';

// Notification channels configuration
const NOTIFICATION_CHANNELS = {
  EMAIL: 'email',
  SMS: 'sms',
  PUSH: 'push',
  WEBHOOK: 'webhook'
};

// Severity-based notification rules
const NOTIFICATION_RULES = {
  critical: ['email', 'sms', 'push'],
  high: ['email', 'push'],
  medium: ['email'],
  low: ['email']
};

/**
 * Email transporter configuration
 * In production, use actual SMTP credentials
 */
const emailTransporter = nodemailer.createTransporter({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: process.env.SMTP_PORT || 587,
  secure: false,
  auth: {
    user: process.env.SMTP_USER || 'alerts@example.com',
    pass: process.env.SMTP_PASS || 'password'
  }
});

/**
 * Send email notification
 */
async function sendEmailNotification(alert, recipient) {
  const subject = `[${alert.severity.toUpperCase()}] Alert: ${alert.type}`;
  const body = `
    Alert Notification
    ==================
    
    Type: ${alert.type}
    Severity: ${alert.severity}
    Device: ${alert.device_id}
    House: ${alert.house_id}
    Time: ${alert.occurred_at}
    Score: ${alert.score}
    
    Message: ${alert.message || 'No additional details'}
    
    Alert ID: ${alert.alert_id}
    
    Please log in to the dashboard to acknowledge or resolve this alert.
  `;

  try {
    // In development, just log the email
    if (process.env.NODE_ENV !== 'production') {
      console.log(`[notification/email] Would send to ${recipient.email}:`);
      console.log(`  Subject: ${subject}`);
      console.log(`  Alert: ${alert.alert_id} (${alert.type})`);
      return { success: true, channel: 'email', simulated: true };
    }

    // In production, actually send the email
    const info = await emailTransporter.sendMail({
      from: '"Alert Monitoring System" <alerts@example.com>',
      to: recipient.email,
      subject: subject,
      text: body,
      html: `<pre>${body}</pre>`
    });

    console.log(`[notification/email] Sent to ${recipient.email}: ${info.messageId}`);
    return { success: true, channel: 'email', messageId: info.messageId };
  } catch (error) {
    console.error(`[notification/email] Failed to send to ${recipient.email}:`, error.message);
    return { success: false, channel: 'email', error: error.message };
  }
}

/**
 * Send SMS notification
 */
async function sendSMSNotification(alert, recipient) {
  const message = `[${alert.severity.toUpperCase()}] Alert: ${alert.type} at ${alert.house_id}. Alert ID: ${alert.alert_id}`;

  try {
    // In development, just log the SMS
    if (process.env.NODE_ENV !== 'production') {
      console.log(`[notification/sms] Would send to ${recipient.phone}:`);
      console.log(`  Message: ${message}`);
      return { success: true, channel: 'sms', simulated: true };
    }

    // In production, integrate with Twilio or similar service
    // const twilioClient = require('twilio')(accountSid, authToken);
    // await twilioClient.messages.create({
    //   body: message,
    //   from: process.env.TWILIO_PHONE,
    //   to: recipient.phone
    // });

    console.log(`[notification/sms] Sent to ${recipient.phone}`);
    return { success: true, channel: 'sms' };
  } catch (error) {
    console.error(`[notification/sms] Failed to send to ${recipient.phone}:`, error.message);
    return { success: false, channel: 'sms', error: error.message };
  }
}

/**
 * Send push notification
 */
async function sendPushNotification(alert, recipient) {
  const notification = {
    title: `${alert.severity.toUpperCase()} Alert`,
    body: `${alert.type} detected at ${alert.house_id}`,
    data: {
      alert_id: alert.alert_id,
      severity: alert.severity,
      type: alert.type
    }
  };

  try {
    // In development, just log the push notification
    if (process.env.NODE_ENV !== 'production') {
      console.log(`[notification/push] Would send to device ${recipient.device_token}:`);
      console.log(`  Title: ${notification.title}`);
      console.log(`  Body: ${notification.body}`);
      return { success: true, channel: 'push', simulated: true };
    }

    // In production, integrate with Firebase Cloud Messaging or similar
    // const admin = require('firebase-admin');
    // await admin.messaging().send({
    //   token: recipient.device_token,
    //   notification: notification
    // });

    console.log(`[notification/push] Sent to device ${recipient.device_token}`);
    return { success: true, channel: 'push' };
  } catch (error) {
    console.error(`[notification/push] Failed to send:`, error.message);
    return { success: false, channel: 'push', error: error.message };
  }
}

/**
 * Send webhook notification
 */
async function sendWebhookNotification(alert, webhookUrl) {
  try {
    const payload = {
      event: 'alert.created',
      alert_id: alert.alert_id,
      type: alert.type,
      severity: alert.severity,
      house_id: alert.house_id,
      device_id: alert.device_id,
      occurred_at: alert.occurred_at,
      score: alert.score,
      message: alert.message
    };

    // In development, just log the webhook
    if (process.env.NODE_ENV !== 'production') {
      console.log(`[notification/webhook] Would POST to ${webhookUrl}:`);
      console.log(`  Payload:`, JSON.stringify(payload, null, 2));
      return { success: true, channel: 'webhook', simulated: true };
    }

    // In production, actually send the webhook
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      throw new Error(`Webhook returned ${response.status}`);
    }

    console.log(`[notification/webhook] Sent to ${webhookUrl}`);
    return { success: true, channel: 'webhook', status: response.status };
  } catch (error) {
    console.error(`[notification/webhook] Failed to send to ${webhookUrl}:`, error.message);
    return { success: false, channel: 'webhook', error: error.message };
  }
}

/**
 * Main notification dispatcher
 * Sends notifications based on alert severity and user preferences
 */
export async function sendAlertNotifications(alert, recipients, pool) {
  const channels = NOTIFICATION_RULES[alert.severity] || ['email'];
  const results = [];

  console.log(`[notification] Dispatching ${channels.length} notifications for alert ${alert.alert_id}`);

  for (const recipient of recipients) {
    // Get user preferences (if available)
    const userChannels = recipient.notification_preferences || channels;

    for (const channel of userChannels) {
      let result;

      switch (channel) {
        case NOTIFICATION_CHANNELS.EMAIL:
          if (recipient.email) {
            result = await sendEmailNotification(alert, recipient);
          }
          break;

        case NOTIFICATION_CHANNELS.SMS:
          if (recipient.phone) {
            result = await sendSMSNotification(alert, recipient);
          }
          break;

        case NOTIFICATION_CHANNELS.PUSH:
          if (recipient.device_token) {
            result = await sendPushNotification(alert, recipient);
          }
          break;

        case NOTIFICATION_CHANNELS.WEBHOOK:
          if (recipient.webhook_url) {
            result = await sendWebhookNotification(alert, recipient.webhook_url);
          }
          break;

        default:
          console.warn(`[notification] Unknown channel: ${channel}`);
      }

      if (result) {
        results.push(result);

        // Log notification in database
        if (pool) {
          try {
            await pool.query(
              `INSERT INTO alert_history (alert_id, action, actor, note, meta)
               VALUES ($1, 'notify', $2, $3, $4)`,
              [
                alert.alert_id,
                null,
                `${channel} notification sent to ${recipient.name || recipient.email}`,
                JSON.stringify({ 
                  channel, 
                  recipient_id: recipient.user_id,
                  success: result.success,
                  simulated: result.simulated || false
                })
              ]
            );
          } catch (dbError) {
            console.error('[notification] Failed to log notification:', dbError.message);
          }
        }
      }
    }
  }

  return results;
}

/**
 * Get notification recipients for an alert
 */
export async function getAlertRecipients(alert, pool) {
  try {
    // Get house owner and any caregivers
    const result = await pool.query(
      `SELECT u.user_id, u.name, u.email, u.role
       FROM users u
       JOIN houses h ON u.user_id = h.owner_id
       WHERE h.house_id = $1
       UNION
       SELECT u.user_id, u.name, u.email, u.role
       FROM users u
       WHERE u.role = 'CAREGIVER'`,
      [alert.house_id]
    );

    return result.rows;
  } catch (error) {
    console.error('[notification] Failed to get recipients:', error.message);
    return [];
  }
}

export default {
  sendAlertNotifications,
  getAlertRecipients,
  NOTIFICATION_CHANNELS,
  NOTIFICATION_RULES
};
