const crypto = require('crypto');
const { findTemplate, adHocTemplate } = require('./templates');
const { render, missingPlaceholders } = require('./render');

const notifications = new Map();
const MAX_NOTIFICATIONS = 500;

// Final statuses a notification can settle into, roughly matching Notify's
// real distribution (delivery succeeds the vast majority of the time).
const FINAL_STATUS_WEIGHTS = [
  { status: 'delivered', weight: 88 },
  { status: 'permanent-failure', weight: 5 },
  { status: 'temporary-failure', weight: 5 },
  { status: 'technical-failure', weight: 2 },
];

function pickFinalStatus() {
  const total = FINAL_STATUS_WEIGHTS.reduce((sum, s) => sum + s.weight, 0);
  let roll = Math.random() * total;
  for (const entry of FINAL_STATUS_WEIGHTS) {
    if (roll < entry.weight) return entry.status;
    roll -= entry.weight;
  }
  return 'delivered';
}

function baseUrl(req) {
  return `${req.protocol}://${req.get('host')}`;
}

class ValidationError extends Error {
  constructor(fields) {
    super('ValidationError');
    this.fields = fields; // array of { error, message }
  }
}

function validateCreate(type, body) {
  const errors = [];
  if (!body || typeof body !== 'object') {
    errors.push({ error: 'ValidationError', message: 'A JSON request body is required' });
    throw new ValidationError(errors);
  }
  if (type === 'sms') {
    if (!body.phone_number) {
      errors.push({ error: 'ValidationError', message: 'phone_number is a required property' });
    } else if (!/^\+?[0-9 ()-]{7,20}$/.test(String(body.phone_number))) {
      errors.push({ error: 'ValidationError', message: 'phone_number is not a valid phone number' });
    }
  }
  if (type === 'email') {
    if (!body.email_address) {
      errors.push({ error: 'ValidationError', message: 'email_address is a required property' });
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(body.email_address))) {
      errors.push({ error: 'ValidationError', message: 'email_address is not a valid email address' });
    }
  }
  if (!body.template_id) {
    errors.push({ error: 'ValidationError', message: 'template_id is a required property' });
  }
  if (errors.length) throw new ValidationError(errors);
}

function createNotification(type, req, broadcast) {
  const body = req.body || {};
  validateCreate(type, body);

  const template = findTemplate(body.template_id) || adHocTemplate(body.template_id, type);
  const personalisation = body.personalisation || {};
  const missing = missingPlaceholders(template.body, personalisation)
    .concat(template.subject ? missingPlaceholders(template.subject, personalisation) : []);
  if (missing.length) {
    throw new ValidationError(
      [...new Set(missing)].map((key) => ({
        error: 'ValidationError',
        message: `Missing personalisation: ${key}`,
      }))
    );
  }

  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const renderedBody = render(template.body, personalisation);
  const renderedSubject = template.subject ? render(template.subject, personalisation) : undefined;

  const notification = {
    id,
    reference: body.reference || null,
    type,
    status: 'created',
    template: {
      id: template.id,
      version: template.version,
      uri: `${baseUrl(req)}/v2/template/${template.id}`,
    },
    body: renderedBody,
    subject: renderedSubject,
    phone_number: type === 'sms' ? body.phone_number : undefined,
    email_address: type === 'email' ? body.email_address : undefined,
    from: type === 'sms' ? 'GOVUK' : 'no-reply@notify.mock',
    created_at: now,
    sent_at: null,
    completed_at: null,
    // testing aid: caller can force a specific outcome instead of the random one
    _forcedStatus: body.personalisation && body.personalisation._mock_status,
  };

  notifications.set(id, notification);
  trimStore();
  broadcast({ type: 'notification', notification: publicView(notification) });

  scheduleLifecycle(notification, broadcast);

  return notification;
}

function trimStore() {
  if (notifications.size <= MAX_NOTIFICATIONS) return;
  const oldestKey = notifications.keys().next().value;
  notifications.delete(oldestKey);
}

function scheduleLifecycle(notification, broadcast) {
  const sendingDelay = 600 + Math.random() * 900;
  const completeDelay = sendingDelay + 1200 + Math.random() * 2200;

  setTimeout(() => {
    notification.status = 'sending';
    notification.sent_at = new Date().toISOString();
    broadcast({ type: 'status_update', id: notification.id, status: notification.status, sent_at: notification.sent_at });
  }, sendingDelay);

  setTimeout(() => {
    const forced = ['delivered', 'permanent-failure', 'temporary-failure', 'technical-failure'].includes(
      notification._forcedStatus
    )
      ? notification._forcedStatus
      : null;
    notification.status = forced || pickFinalStatus();
    notification.completed_at = new Date().toISOString();
    broadcast({
      type: 'status_update',
      id: notification.id,
      status: notification.status,
      completed_at: notification.completed_at,
    });
  }, completeDelay);
}

function publicView(notification) {
  // strip internal-only fields before sending to clients/API responses
  const { _forcedStatus, ...rest } = notification;
  return rest;
}

function getNotification(id) {
  const n = notifications.get(id);
  return n ? publicView(n) : null;
}

function listNotifications({ status, template_type, reference } = {}) {
  let all = [...notifications.values()].map(publicView);
  if (status) all = all.filter((n) => n.status === status);
  if (template_type) all = all.filter((n) => n.type === template_type);
  if (reference) all = all.filter((n) => n.reference === reference);
  return all.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
}

module.exports = {
  createNotification,
  getNotification,
  listNotifications,
  publicView,
  baseUrl,
  ValidationError,
};
