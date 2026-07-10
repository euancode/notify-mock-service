const express = require('express');
const http = require('http');
const path = require('path');
const crypto = require('crypto');
const { WebSocketServer } = require('ws');

const { requireAuth, maskToken } = require('./lib/auth');
const { templates, findTemplate } = require('./lib/templates');
const store = require('./lib/store');

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: '/ws' });

const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: '1mb' }));
app.use(express.static(path.join(__dirname, 'public')));

function broadcast(event) {
  const payload = JSON.stringify(event);
  wss.clients.forEach((client) => {
    if (client.readyState === 1) client.send(payload);
  });
}

// Log every call under /v2 to the dashboard feed, and its eventual response,
// regardless of outcome - lets the dashboard show request/response pairs.
app.use('/v2', (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const requestId = crypto.randomUUID();
  req.notifyRequestId = requestId;

  broadcast({
    type: 'request',
    id: requestId,
    timestamp: new Date().toISOString(),
    method: req.method,
    path: req.originalUrl,
    authorization: authHeader ? maskToken(authHeader.replace(/^Bearer\s+/i, '')) : null,
    body: req.body,
  });

  const originalJson = res.json.bind(res);
  res.json = (body) => {
    res.locals.responseBody = body;
    return originalJson(body);
  };

  res.on('finish', () => {
    broadcast({
      type: 'response',
      id: requestId,
      status: res.statusCode,
      body: res.locals.responseBody,
      timestamp: new Date().toISOString(),
    });
  });

  next();
});

function respondError(res, err) {
  if (err instanceof store.ValidationError) {
    return res.status(400).json({ errors: err.fields, status_code: 400 });
  }
  console.error(err);
  return res.status(500).json({
    errors: [{ error: 'Exception', message: 'Internal server error' }],
    status_code: 500,
  });
}

function notificationResponse(req, notification) {
  const base = store.baseUrl(req);
  const content = { body: notification.body };
  if (notification.type === 'sms') {
    content.from_number = notification.from;
  } else {
    content.subject = notification.subject;
    content.from_email = notification.from;
  }
  return {
    id: notification.id,
    reference: notification.reference,
    content,
    uri: `${base}/v2/notifications/${notification.id}`,
    template: notification.template,
  };
}

// ---- Notifications ----

app.post('/v2/notifications/sms', requireAuth, (req, res) => {
  try {
    const notification = store.createNotification('sms', req, broadcast);
    res.status(201).json(notificationResponse(req, notification));
  } catch (err) {
    respondError(res, err);
  }
});

app.post('/v2/notifications/email', requireAuth, (req, res) => {
  try {
    const notification = store.createNotification('email', req, broadcast);
    res.status(201).json(notificationResponse(req, notification));
  } catch (err) {
    respondError(res, err);
  }
});

app.get('/v2/notifications/:id', requireAuth, (req, res) => {
  const notification = store.getNotification(req.params.id);
  if (!notification) {
    return res.status(404).json({
      errors: [{ error: 'NoResultFound', message: 'No result found' }],
      status_code: 404,
    });
  }
  res.json(notification);
});

app.get('/v2/notifications', requireAuth, (req, res) => {
  const { status, template_type, reference } = req.query;
  const notifications = store.listNotifications({ status, template_type, reference });
  res.json({
    notifications,
    links: { current: `${store.baseUrl(req)}/v2/notifications`, next: null },
  });
});

// ---- Templates ----

app.get('/v2/templates', requireAuth, (req, res) => {
  const { type } = req.query;
  const list = type ? templates.filter((t) => t.type === type) : templates;
  res.json({ templates: list });
});

app.get('/v2/template/:id', requireAuth, (req, res) => {
  const template = findTemplate(req.params.id);
  if (!template) {
    return res.status(404).json({
      errors: [{ error: 'NoResultFound', message: 'No result found' }],
      status_code: 404,
    });
  }
  res.json(template);
});

app.post('/v2/template/:id/preview', requireAuth, (req, res) => {
  const template = findTemplate(req.params.id);
  if (!template) {
    return res.status(404).json({
      errors: [{ error: 'NoResultFound', message: 'No result found' }],
      status_code: 404,
    });
  }
  const { render } = require('./lib/render');
  const personalisation = (req.body && req.body.personalisation) || {};
  res.json({
    id: template.id,
    type: template.type,
    version: template.version,
    body: render(template.body, personalisation),
    subject: template.subject ? render(template.subject, personalisation) : undefined,
  });
});

// ---- Dashboard support API (not part of the mocked Notify surface) ----

app.get('/api/dashboard/notifications', (req, res) => {
  res.json({ notifications: store.listNotifications().slice(0, 50) });
});

app.get('/healthcheck', (req, res) => res.json({ status: 'ok' }));

app.get('/docs', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'docs.html'));
});

// Malformed JSON bodies fail inside express.json() before reaching any route,
// so without this they'd surface as an unhelpful HTML 400 instead of the
// same Notify-style error shape everything else returns.
app.use((err, req, res, next) => {
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({
      errors: [{ error: 'BadRequestError', message: 'Invalid JSON body' }],
      status_code: 400,
    });
  }
  next(err);
});

server.listen(PORT, () => {
  console.log(`GOV.UK Notify mock service listening on port ${PORT}`);
});
