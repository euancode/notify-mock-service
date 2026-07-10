const crypto = require('crypto');

// Seed templates, structured the same way GOV.UK Notify returns them.
const templates = [
  {
    id: '8a5e1b3a-0000-4000-8000-000000000001',
    type: 'sms',
    name: 'Verification code',
    body: 'Your verification code is ((code)). It expires in 5 minutes.',
    subject: null,
    version: 1,
    created_at: '2024-01-01T09:00:00.000Z',
    updated_at: null,
    created_by: 'mock@notify.example',
  },
  {
    id: '8a5e1b3a-0000-4000-8000-000000000002',
    type: 'sms',
    name: 'Appointment reminder',
    body: 'Hi ((first_name)), this is a reminder of your appointment on ((appointment_date)) at ((appointment_time)).',
    subject: null,
    version: 1,
    created_at: '2024-01-01T09:00:00.000Z',
    updated_at: null,
    created_by: 'mock@notify.example',
  },
  {
    id: '8a5e1b3a-0000-4000-8000-000000000003',
    type: 'email',
    name: 'Welcome email',
    body: 'Hello ((first_name)),\n\nWelcome to the service. Your reference number is ((reference)).\n\nThanks,\nThe Team',
    subject: 'Welcome to the service',
    version: 1,
    created_at: '2024-01-01T09:00:00.000Z',
    updated_at: null,
    created_by: 'mock@notify.example',
  },
  {
    id: '8a5e1b3a-0000-4000-8000-000000000004',
    type: 'email',
    name: 'Password reset',
    body: 'Hi ((first_name)),\n\nClick the link below to reset your password:\n((reset_link))\n\nIf you did not request this, ignore this email.',
    subject: 'Reset your password',
    version: 1,
    created_at: '2024-01-01T09:00:00.000Z',
    updated_at: null,
    created_by: 'mock@notify.example',
  },
];

function findTemplate(id) {
  return templates.find((t) => t.id === id);
}

// Fallback used when a caller supplies a template_id we don't recognise -
// keeps the mock permissive rather than forcing callers to pre-register templates.
function adHocTemplate(id, type) {
  return {
    id: id || crypto.randomUUID(),
    type,
    name: 'Ad-hoc template',
    body: type === 'sms'
      ? '((message))'
      : '((message))',
    subject: type === 'email' ? '((subject))' : null,
    version: 1,
    created_at: new Date().toISOString(),
    updated_at: null,
    created_by: 'mock@notify.example',
  };
}

module.exports = { templates, findTemplate, adHocTemplate };
