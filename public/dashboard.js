(function () {
  const connDot = document.getElementById('connDot');
  const connText = document.getElementById('connText');
  const requestFeed = document.getElementById('requestFeed');
  const requestCount = document.getElementById('requestCount');
  const phoneNotifications = document.getElementById('phoneNotifications');
  const emailList = document.getElementById('emailList');
  const emailCount = document.getElementById('emailCount');
  const clock = document.getElementById('clock');
  const bigClock = document.getElementById('bigClock');
  const bigDate = document.getElementById('bigDate');

  let requestTotal = 0;
  let emailTotal = 0;
  const MAX_FEED_ITEMS = 40;
  const MAX_SMS_TOASTS = 4;
  const MAX_EMAIL_ITEMS = 12;

  function tickClock() {
    const now = new Date();
    const time = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const date = now.toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'long' });
    clock.textContent = time;
    bigClock.textContent = time;
    bigDate.textContent = date;
  }
  tickClock();
  setInterval(tickClock, 15000);

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  function formatTime(iso) {
    try {
      return new Date(iso).toLocaleTimeString();
    } catch (e) {
      return iso;
    }
  }

  function addRequestToFeed(entry) {
    const empty = requestFeed.querySelector('.feed-empty');
    if (empty) empty.remove();

    requestTotal += 1;
    requestCount.textContent = requestTotal;

    const item = document.createElement('div');
    item.className = `feed-item method-${entry.method}`;
    const bodyStr = entry.body && Object.keys(entry.body).length
      ? JSON.stringify(entry.body, null, 2)
      : null;

    item.innerHTML = `
      <div class="feed-item__top">
        <span><span class="feed-item__method">${entry.method}</span> ${escapeHtml(entry.path)}</span>
        <span class="feed-item__time">${formatTime(entry.timestamp)}</span>
      </div>
      ${entry.authorization ? `<div style="color:#505a5f">Authorization: Bearer ${escapeHtml(entry.authorization)}</div>` : ''}
      ${bodyStr ? `<pre>${escapeHtml(bodyStr)}</pre>` : ''}
    `;
    requestFeed.prepend(item);

    while (requestFeed.children.length > MAX_FEED_ITEMS) {
      requestFeed.removeChild(requestFeed.lastChild);
    }
  }

  function addSmsToast(notification) {
    const placeholder = phoneNotifications.querySelector('.phone-placeholder');
    if (placeholder) placeholder.remove();

    const toast = document.createElement('div');
    toast.className = 'sms-toast';
    toast.dataset.id = notification.id;
    toast.innerHTML = `
      <div class="sms-toast__top">
        <span class="sms-toast__sender"><span class="icon">SMS</span> GOV.UK Notify</span>
        <span>now</span>
      </div>
      <div class="sms-toast__body">${escapeHtml(notification.body)}</div>
      <div class="sms-toast__to">To: ${escapeHtml(notification.phone_number || 'unknown')} · <span class="badge created">created</span></div>
    `;
    phoneNotifications.prepend(toast);

    while (phoneNotifications.children.length > MAX_SMS_TOASTS) {
      phoneNotifications.removeChild(phoneNotifications.lastChild);
    }
  }

  function addEmailItem(notification) {
    const empty = emailList.querySelector('.feed-empty');
    if (empty) empty.remove();

    emailTotal += 1;
    emailCount.textContent = emailTotal;

    const item = document.createElement('div');
    item.className = 'email-item';
    item.dataset.id = notification.id;
    item.innerHTML = `
      <div class="email-item__subject">${escapeHtml(notification.subject || '(no subject)')}</div>
      <div class="email-item__to">To: ${escapeHtml(notification.email_address || 'unknown')}</div>
      <div><span class="badge created">created</span></div>
    `;
    emailList.prepend(item);

    while (emailList.children.length > MAX_EMAIL_ITEMS) {
      emailList.removeChild(emailList.lastChild);
    }
  }

  function updateStatusBadges(id, status) {
    document.querySelectorAll(`[data-id="${id}"] .badge`).forEach((badge) => {
      badge.textContent = status;
      badge.className = `badge ${status}`;
    });
  }

  function connect() {
    const protocol = location.protocol === 'https:' ? 'wss' : 'ws';
    const ws = new WebSocket(`${protocol}://${location.host}/ws`);

    ws.addEventListener('open', () => {
      connDot.className = 'dot connected';
      connText.textContent = 'Connected — listening for API calls';
    });

    ws.addEventListener('close', () => {
      connDot.className = 'dot disconnected';
      connText.textContent = 'Disconnected — retrying…';
      setTimeout(connect, 1500);
    });

    ws.addEventListener('error', () => ws.close());

    ws.addEventListener('message', (event) => {
      let msg;
      try {
        msg = JSON.parse(event.data);
      } catch (e) {
        return;
      }

      if (msg.type === 'request') {
        addRequestToFeed(msg);
      } else if (msg.type === 'notification') {
        if (msg.notification.type === 'sms') {
          addSmsToast(msg.notification);
        } else if (msg.notification.type === 'email') {
          addEmailItem(msg.notification);
        }
      } else if (msg.type === 'status_update') {
        updateStatusBadges(msg.id, msg.status);
      }
    });
  }

  connect();
})();
