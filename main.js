/* =============================================================================
   BuySafe by Evoproptech — interaction layer
   No dependencies. Progressive enhancement: everything degrades to plain HTML.
   ============================================================================= */
(function () {
  'use strict';

  /* ===========================================================================
     LEAD DELIVERY — the only block you need to edit to go live.
     ---------------------------------------------------------------------------
     Set `provider` and fill in the matching credential below. Until a real
     provider is configured the forms REFUSE to report success: they show the
     failure panel and hand the visitor a pre-filled WhatsApp message instead.
     That is deliberate. A form that silently swallows leads while showing a
     tick is worse than one that visibly fails, because nobody finds out.

       'privyr'     — Privyr CRM generic webhook (currently active).
       'web3forms'  — no backend, free, emails you each lead.
       'formspree'  — formspree.io, paste the form ID from your dashboard.
       'gsheet'     — Google Apps Script web app writing to a Sheet you own.
       'webhook'    — any other endpoint, receives the raw JSON payload.

     SECURITY NOTE on privyr: the webhook URL is its own credential, and
     anything in this file is public. Someone reading the page source can post
     junk straight into your CRM. The honeypot and time-trap stop casual bots,
     not a determined one. If that becomes a problem, rotate the URL in Privyr
     and move the call behind a serverless proxy that holds the URL server-side
     and rate-limits by IP — the adapter below is the only thing that changes.
     =========================================================================== */
  var LEAD_CONFIG = {
    provider: 'privyr',

    privyrUrl:    'https://www.privyr.com/api/v1/incoming-leads/0vZfjMQw/u6UepzLR',
    web3formsKey: '',
    formspreeId:  '',
    gsheetUrl:    '',
    webhookUrl:   '',

    subject:  'New BuySafe lead — evoproptech.com',
    whatsapp: '919987117947',
    phone:    '+91 99871 17947',
    timeoutMs: 12000
  };

  var $  = function (s, c) { return (c || document).querySelector(s); };
  var $$ = function (s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); };

  /* ===========================================================================
     ANALYTICS — fill in an ID to switch a destination on. Leave blank and that
     tag is simply never loaded, so no third-party script runs and nothing is
     sent. Every CTA already carries data-cta and every funnel step already
     calls track(), so an ID is the only thing standing between you and data.
     =========================================================================== */
  var ANALYTICS = {
    ga4:        'G-D6L4NRTFT9', // Google Analytics 4
    googleAds:  '',    // 'AW-XXXXXXXXX'   Google Ads (for conversion import)
    metaPixel:  '1548349143712281', // Meta Pixel / dataset ID
    conversionLabel: '' // 'AW-XXXXXXXXX/AbC-D_efGh'  fires on lead_success
  };

  /* Tags are injected only when configured, and only after the page is
     interactive, so measurement never competes with first paint. */
  function loadAnalytics() {
    var tasks = [];

    if (ANALYTICS.ga4 || ANALYTICS.googleAds) {
      var id = ANALYTICS.ga4 || ANALYTICS.googleAds;
      window.dataLayer = window.dataLayer || [];
      window.gtag = window.gtag || function () { window.dataLayer.push(arguments); };
      window.gtag('js', new Date());
      if (ANALYTICS.ga4) window.gtag('config', ANALYTICS.ga4, { send_page_view: true });
      if (ANALYTICS.googleAds) window.gtag('config', ANALYTICS.googleAds);

      var s = document.createElement('script');
      s.async = true;
      s.src = 'https://www.googletagmanager.com/gtag/js?id=' + encodeURIComponent(id);
      document.head.appendChild(s);
      tasks.push('gtag:' + id);
    }

    if (ANALYTICS.metaPixel) {
      /* eslint-disable */
      !function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?
      n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;
      n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;
      t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}
      (window,document,'script','https://connect.facebook.net/en_US/fbevents.js');
      /* eslint-enable */
      window.fbq('init', ANALYTICS.metaPixel);
      window.fbq('track', 'PageView');
      tasks.push('meta:' + ANALYTICS.metaPixel);
    }

    if (window.EVO_DEBUG) console.info('[EVO] analytics loaded:', tasks.length ? tasks : 'none configured');
  }

  if (document.readyState === 'complete') setTimeout(loadAnalytics, 0);
  else window.addEventListener('load', function () { setTimeout(loadAnalytics, 0); });

  /* --------------------------------------------------------------- analytics
     One funnel for every CTA and form event. dataLayer is always populated
     (so GTM works if you prefer it), and configured destinations are mirrored.
     A lead_success additionally fires the platform conversion events that ad
     bidding actually optimises against. */
  function track(event, params) {
    var payload = Object.assign({ event: event }, params || {});
    (window.dataLayer = window.dataLayer || []).push(payload);

    if (typeof window.gtag === 'function') {
      window.gtag('event', event, params || {});
      if (event === 'lead_success' && ANALYTICS.conversionLabel) {
        window.gtag('event', 'conversion', { send_to: ANALYTICS.conversionLabel });
      }
    }

    /* Meta gets a deliberately short list. Its ad delivery learns from the
       events it receives, so a wrong one is worse than none: this form was
       previously reported as InitiateCheckout, a shopping-cart event, which
       would have trained delivery towards people starting a checkout that
       does not exist. Lead fires only on a confirmed submission. Nothing
       carrying budget or contact details is sent. */
    if (typeof window.fbq === 'function') {
      if (event === 'lead_success') window.fbq('track', 'Lead');
      else if (event === 'lead_handoff_whatsapp') window.fbq('track', 'Contact');
      else if (event === 'cta_click') window.fbq('trackCustom', 'CtaClick', { cta: (params && params.cta) || '' });
    }

    if (window.EVO_DEBUG) console.info('[track]', payload);
  }

  document.addEventListener('click', function (e) {
    var el = e.target.closest('[data-cta]');
    if (el && el.tagName !== 'BUTTON') track('cta_click', { cta: el.dataset.cta, href: el.getAttribute('href') });
  });

  /* ------------------------------------------------------------ announcement
     Dismissal persists for the session only, so a returning visitor still sees
     the offer. Storage is wrapped — private mode can throw on access. */
  var announce = $('#announce');
  var announceClose = $('#announce-close');

  function store(key, val) {
    try { if (val === undefined) return sessionStorage.getItem(key); sessionStorage.setItem(key, val); }
    catch (err) { return null; }
  }

  if (announce && store('evo-announce-closed') === '1') announce.hidden = true;
  if (announceClose) {
    announceClose.addEventListener('click', function () {
      announce.hidden = true;
      store('evo-announce-closed', '1');
      track('announce_dismissed');
    });
  }

  /* -------------------------------------------------------------------- year */
  var year = $('#year');
  if (year) year.textContent = new Date().getFullYear();

  /* --------------------------------------------------------------- mobile nav
     Below 900px the primary links live here. Closes on link click, on Escape,
     and on resize past the breakpoint so state can't desync from the layout. */
  var navToggle = $('#navtoggle');
  var mobileNav = $('#mobilenav');

  if (navToggle && mobileNav) {
    var setNav = function (open) {
      navToggle.setAttribute('aria-expanded', String(open));
      navToggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
      mobileNav.hidden = !open;
      document.body.classList.toggle('nav-open', open);
    };

    navToggle.addEventListener('click', function () {
      var open = navToggle.getAttribute('aria-expanded') === 'true';
      setNav(!open);
      if (!open) track('mobile_nav_open');
    });

    $$('a', mobileNav).forEach(function (a) {
      a.addEventListener('click', function () { setNav(false); });
    });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && navToggle.getAttribute('aria-expanded') === 'true') {
        setNav(false);
        navToggle.focus();
      }
    });

    window.addEventListener('resize', function () {
      if (window.innerWidth >= 900) setNav(false);
    }, { passive: true });
  }

  /* ------------------------------------------------------------------- gauge
     The SVG ships at the final value, so the score is correct with no JS at
     all. Here we rewind it and animate only when we can actually see it
     through — never leaving it stranded at a partial number. */
  var SCORE = 78;
  var ARC = 251.3; // path length of the semicircle in the SVG
  var gaugeFill = $('#gauge-fill');
  var gaugeNum  = $('#gauge-num');
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function setGauge(value) {
    if (gaugeFill) gaugeFill.style.strokeDashoffset = String(ARC - (ARC * value) / 100);
    if (gaugeNum) gaugeNum.textContent = String(Math.round(value));
  }

  function runGauge() {
    if (reduceMotion) { setGauge(SCORE); return; }
    var start = null, dur = 1400;
    function frame(ts) {
      if (start === null) start = ts;
      var t = Math.min((ts - start) / dur, 1);
      var eased = 1 - Math.pow(1 - t, 3); // easeOutCubic
      setGauge(SCORE * eased);
      if (t < 1) requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  }

  /* ------------------------------------------------------------ gauge trigger
     Content itself is never hidden (see styles.css), so the only thing left to
     schedule is the count-up. It runs once, when the card is on screen and the
     page is actually visible; anything else leaves the static 78 in place. */
  var scorecard = $('.scorecard');
  var gaugeStarted = false;

  function startGauge() {
    if (gaugeStarted) return;
    gaugeStarted = true;
    setGauge(0);       // rewind from the server-rendered value…
    runGauge();        // …and count up to it.
    // rAF is paused while the tab is hidden, which would strand the count
    // mid-way. Force the true value once the animation should have finished.
    setTimeout(function () { setGauge(SCORE); }, 2600);
  }

  if (scorecard && !reduceMotion && 'IntersectionObserver' in window) {
    var gaugeIo = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        if (document.visibilityState === 'visible') startGauge();
        gaugeIo.unobserve(entry.target);
      });
    }, { threshold: 0.35 });
    gaugeIo.observe(scorecard);
  }

  /* -------------------------------------------------------------------- tabs
     Full ARIA tab pattern including arrow-key roving focus. */
  var tablist = $('[role="tablist"]');
  if (tablist) {
    var tabs = $$('[role="tab"]', tablist);

    function selectTab(tab, focus) {
      tabs.forEach(function (t) {
        var selected = t === tab;
        t.setAttribute('aria-selected', String(selected));
        t.tabIndex = selected ? 0 : -1;
        var panel = document.getElementById(t.getAttribute('aria-controls'));
        if (panel) panel.hidden = !selected;
      });
      if (focus) tab.focus();
      track('stage_tab', { stage: tab.id.replace('tab-', '') });
    }

    tabs.forEach(function (tab, i) {
      tab.addEventListener('click', function () { selectTab(tab, false); });
      tab.addEventListener('keydown', function (e) {
        var next = null;
        if (e.key === 'ArrowRight') next = tabs[(i + 1) % tabs.length];
        else if (e.key === 'ArrowLeft') next = tabs[(i - 1 + tabs.length) % tabs.length];
        else if (e.key === 'Home') next = tabs[0];
        else if (e.key === 'End') next = tabs[tabs.length - 1];
        if (next) { e.preventDefault(); selectTab(next, true); }
      });
    });
  }

  /* ------------------------------------------------------------ sticky mobile
     Appears once the hero CTA has scrolled away, hides again over the final
     form so it never covers the thing it is pointing at. */
  var mobileCta = $('#mobile-cta');
  var heroCta   = $('.hero__cta');
  var finalCard = $('.final-card');

  if (mobileCta && heroCta && 'IntersectionObserver' in window) {
    var heroVisible = true, finalVisible = false;

    function syncStickyCta() {
      mobileCta.classList.toggle('is-visible', !heroVisible && !finalVisible);
    }

    new IntersectionObserver(function (e) {
      heroVisible = e[0].isIntersecting; syncStickyCta();
    }, { threshold: 0 }).observe(heroCta);

    if (finalCard) {
      new IntersectionObserver(function (e) {
        finalVisible = e[0].isIntersecting; syncStickyCta();
      }, { threshold: 0.1 }).observe(finalCard);
    }
  }

  /* The "N analyst slots left" counter that used to live here was removed on
     purpose. It derived a number from the day of the week — invented scarcity,
     not real capacity. India's CCPA dark-pattern guidelines (2023) name false
     urgency explicitly, and on a page whose entire pitch is independence it was
     the one element actively arguing against us. If you ever want to show real
     capacity, read it from the booking system; never synthesise it. */

  /* ------------------------------------------------------------- form helpers */
  function setError(input, message) {
    var id = input.id || input.name;
    var slot = document.querySelector('[data-err-for="' + id + '"]');
    if (slot) slot.textContent = message || '';
    if (message) input.setAttribute('aria-invalid', 'true');
    else input.removeAttribute('aria-invalid');
  }

  /* The visible label text, minus the required asterisk — reused verbatim in
     the error summary so the summary names fields the way the form does. */
  function labelFor(input) {
    var el = input.closest('.field');
    var label = el && (el.querySelector('label[for="' + input.id + '"]') || el.querySelector('.field-label'));
    return label ? label.textContent.replace('*', '').trim() : (input.name || 'This field');
  }

  /* Error summary: one announcement for a failed submit, each item linking to
     the field that caused it. Focus moves here rather than to the first bad
     input, so a screen reader user hears the whole list before landing in it.
     Inline messages stay put — the summary is in addition to them, not
     instead of them. */
  function showSummary(form, problems) {
    var box = form.querySelector('[data-error-summary]');
    if (!box) {                       // no summary in this form; fall back
      var first = document.getElementById(problems[0].id);
      if (first) first.focus();
      return;
    }
    var list = box.querySelector('ul');
    list.textContent = '';
    problems.forEach(function (p) {
      var li = document.createElement('li');
      var a = document.createElement('a');
      a.href = '#' + p.id;
      a.textContent = p.label + ' — ' + p.message;
      a.addEventListener('click', function (e) {
        e.preventDefault();
        var target = document.getElementById(p.id);
        if (target) target.focus();
      });
      li.appendChild(a);
      list.appendChild(li);
    });
    box.hidden = false;
    box.focus();
  }

  function clearSummary(form) {
    var box = form.querySelector('[data-error-summary]');
    if (box) { box.hidden = true; box.querySelector('ul').textContent = ''; }
  }

  function validName(v) { return v.trim().length >= 2; }
  function validEmail(v) { return /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(v.trim()); }
  function validPhone(v) {
    var digits = v.replace(/\D/g, '');
    if (digits.length === 12 && digits.indexOf('91') === 0) digits = digits.slice(2);
    if (digits.length === 11 && digits.charAt(0) === '0') digits = digits.slice(1);
    return /^[6-9]\d{9}$/.test(digits);
  }

  function validateField(input) {
    var v = input.value;
    if (input.name === 'name')  { var okN = validName(v);  setError(input, okN ? '' : 'Please enter your full name.'); return okN; }
    if (input.name === 'phone') { var okP = validPhone(v); setError(input, okP ? '' : 'Enter a valid 10-digit Indian mobile number.'); return okP; }
    if (input.name === 'email') { var okE = validEmail(v); setError(input, okE ? '' : 'Enter a valid email address.'); return okE; }
    return true;
  }

  /* ------------------------------------------------------- attribution
     Captured once on load: which ad/campaign produced this lead. Stored for
     the session so it survives the visitor scrolling around before they
     submit, and sent with every lead. Without this you cannot tell which
     spend is working. */
  var ATTRIBUTION = (function () {
    var KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'gclid', 'fbclid'];

    var saved = {};
    try { saved = JSON.parse(sessionStorage.getItem('evo-attribution') || '{}'); } catch (e) {}

    var q = new URLSearchParams(location.search);
    var incoming = {};
    KEYS.forEach(function (k) { if (q.get(k)) incoming[k] = q.get(k); });
    var hasIncoming = Object.keys(incoming).length > 0;

    /* First touch is kept for good, but a later ad click in the same session
       must not be swallowed by it — otherwise a visitor who browses first and
       clicks the ad second converts as "direct" and the campaign gets no
       credit. So: record first touch once, and refresh last touch whenever
       tagged params actually arrive. */
    var attr = saved.captured ? saved : {
      captured: true,
      landing_page: location.pathname,
      referrer: (document.referrer && document.referrer.indexOf(location.host) === -1) ? document.referrer : undefined
    };

    if (hasIncoming) {
      if (!attr.utm_source && !attr.gclid && !attr.fbclid) {
        Object.assign(attr, incoming);              // first tagged touch
      }
      KEYS.forEach(function (k) {                    // always keep the newest
        if (incoming[k]) attr['last_' + k] = incoming[k];
      });
    }

    try { sessionStorage.setItem('evo-attribution', JSON.stringify(attr)); } catch (e) {}
    return attr;
  })();

  /* ------------------------------------------------------------ providers
     Each adapter returns { url, options } for fetch. Adding a provider means
     adding one case here; nothing else in the file changes. */
  /* Budget arrives as a form value ("1-2Cr"); a CRM record should read the way
     a person would say it. */
  var BUDGET_LABELS = {
    '50L-1Cr': '₹50 lakh – ₹1 crore',
    '1-2Cr':   '₹1 crore – ₹2 crore',
    '2-5Cr':   '₹2 crore – ₹5 crore',
    '5Cr+':    '₹5 crore and above'
  };

  var FORM_LABELS = {
    hero:      'Hero form (top of page)',
    final:     'Consultation form (bottom of page)',
    checklist: 'Free 27-point checklist download'
  };

  /* Indian mobile, normalised to E.164 so the CRM can dial and match it. */
  function normalisePhone(raw) {
    if (!raw) return '';
    var d = String(raw).replace(/\D/g, '');
    if (d.length === 12 && d.indexOf('91') === 0) d = d.slice(2);
    if (d.length === 11 && d.charAt(0) === '0') d = d.slice(1);
    return d.length === 10 ? '+91' + d : String(raw).trim();
  }

  /* A readable one-line provenance string beats seven utm_* columns in a CRM
     list view. Falls back to the referrer, then to direct. */
  function sourceSummary(d) {
    if (d.utm_source) {
      var s = d.utm_source;
      if (d.utm_medium) s += ' / ' + d.utm_medium;
      if (d.utm_campaign) s += ' / ' + d.utm_campaign;
      return s;
    }
    if (d.gclid) return 'Google Ads (gclid)';
    if (d.fbclid) return 'Meta Ads (fbclid)';
    if (d.referrer) { try { return 'Referral: ' + new URL(d.referrer).hostname; } catch (e) { return 'Referral'; } }
    return 'Direct / organic';
  }

  function buildRequest(data) {
    var c = LEAD_CONFIG;
    var json = { 'Content-Type': 'application/json', Accept: 'application/json' };

    if (c.provider === 'privyr') {
      if (!c.privyrUrl) return null;

      var notes = [
        'Form: '   + (FORM_LABELS[data.form] || data.form || '—'),
        'Budget: ' + (BUDGET_LABELS[data.budget] || data.budget || 'Not stated'),
        'Location: ' + (data.city || 'Not stated'),
        'Source: ' + sourceSummary(data),
        'Landing page: ' + (data.landing_page || '/'),
        'Submitted: ' + new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })
      ];
      if (data.utm_campaign) notes.push('Campaign: ' + data.utm_campaign);
      if (data.gclid) notes.push('gclid: ' + data.gclid);

      var payload = {
        name:  data.name || 'Website enquiry',
        phone: normalisePhone(data.phone),
        email: data.email || '',
        // Privyr surfaces unknown keys as custom fields on the lead.
        budget: BUDGET_LABELS[data.budget] || data.budget || '',
        location: data.city || '',
        source: sourceSummary(data),
        form: FORM_LABELS[data.form] || data.form || '',
        notes: notes.join('\n')
      };
      Object.keys(payload).forEach(function (k) { if (!payload[k]) delete payload[k]; });

      return {
        url: c.privyrUrl,
        options: { method: 'POST', headers: json, body: JSON.stringify(payload) },
        validate: function (body) { return body && body.success === true; }
      };
    }

    if (c.provider === 'web3forms') {
      if (!c.web3formsKey || c.web3formsKey.indexOf('PASTE_') === 0) return null;
      return {
        url: 'https://api.web3forms.com/submit',
        options: {
          method: 'POST', headers: json,
          body: JSON.stringify(Object.assign({
            access_key: c.web3formsKey,
            subject: c.subject,
            from_name: 'BuySafe website'
          }, data))
        }
      };
    }

    if (c.provider === 'formspree') {
      if (!c.formspreeId) return null;
      return {
        url: 'https://formspree.io/f/' + c.formspreeId,
        options: { method: 'POST', headers: json, body: JSON.stringify(data) }
      };
    }

    if (c.provider === 'gsheet') {
      if (!c.gsheetUrl) return null;
      // Apps Script rejects a JSON preflight; text/plain keeps it a simple request.
      return {
        url: c.gsheetUrl,
        options: { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(data) }
      };
    }

    if (c.provider === 'webhook') {
      if (!c.webhookUrl) return null;
      return { url: c.webhookUrl, options: { method: 'POST', headers: json, body: JSON.stringify(data) } };
    }

    return null;
  }

  /* --------------------------------------------------------------- sendLead
     A real network call. Rejects on anything that is not a confirmed write,
     so the caller can never paint a success state over a lost lead.
     Retries once on a network-level failure (flaky mobile data), but never on
     a 4xx — a bad key will not fix itself on the second attempt. */
  function postOnce(req) {
    var controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    var timer = controller && setTimeout(function () { controller.abort(); }, LEAD_CONFIG.timeoutMs);
    var opts = Object.assign({}, req.options, controller ? { signal: controller.signal } : {});

    return fetch(req.url, opts).then(function (res) {
      if (timer) clearTimeout(timer);
      if (!res.ok) {
        var err = new Error('HTTP ' + res.status);
        err.status = res.status;
        err.permanent = res.status >= 400 && res.status < 500;
        throw err;
      }
      /* A 200 is not the same as an accepted lead. Privyr answers
         {"success":true,...}; if a provider declares a body check, the lead
         only counts once the body agrees. Otherwise we would paint a success
         state over a rejected submission. */
      if (!req.validate) return res;
      return res.clone().json().then(function (body) {
        if (req.validate(body)) return res;
        var e = new Error('Endpoint rejected the lead');
        e.permanent = true;
        e.body = body;
        throw e;
      }, function () {
        return res;   // unparseable body on a 200 — accept the status
      });
    }, function (err) {
      if (timer) clearTimeout(timer);
      throw err;    // network/abort — retryable
    });
  }

  function sendLead(data) {
    var req = buildRequest(Object.assign({}, data, ATTRIBUTION));

    if (!req) {
      var e = new Error('Lead delivery is not configured (LEAD_CONFIG.provider).');
      e.unconfigured = true;
      e.permanent = true;
      console.error('[EVO] ' + e.message + ' Leads are NOT being captured.');
      return Promise.reject(e);
    }

    return postOnce(req).catch(function (err) {
      if (err.permanent) throw err;
      return new Promise(function (r) { setTimeout(r, 900); }).then(function () { return postOnce(req); });
    });
  }

  /* A route that survives a failed submit: the visitor's details, pre-filled
     into WhatsApp, so a broken endpoint costs us a click rather than a lead. */
  function whatsappFallback(data) {
    var lines = ['Hi BuySafe team, I would like a Property Health Score.'];
    if (data.name)   lines.push('Name: ' + data.name);
    if (data.phone)  lines.push('Phone: ' + data.phone);
    if (data.email)  lines.push('Email: ' + data.email);
    if (data.city)   lines.push('Location: ' + data.city);
    if (data.budget) lines.push('Budget: ' + data.budget);
    return 'https://wa.me/' + LEAD_CONFIG.whatsapp + '?text=' + encodeURIComponent(lines.join('\n'));
  }

  /* Keep the payload locally if it never reached the server, so it can be
     recovered from the console rather than being gone for good. */
  function stashFailedLead(data) {
    try {
      var all = JSON.parse(localStorage.getItem('evo-unsent-leads') || '[]');
      all.push(Object.assign({ failed_at: new Date().toISOString() }, data));
      localStorage.setItem('evo-unsent-leads', JSON.stringify(all.slice(-20)));
    } catch (e) {}
  }

  $$('form[data-form]').forEach(function (form) {
    var formName = form.dataset.form;

    /* Time trap: a human takes seconds to fill this in, a bot posts instantly.
       Timed from first interaction, not page load, so someone who reads the
       page for a while before starting is never penalised. */
    var firstTouch = 0;
    form.addEventListener('input', function () { if (!firstTouch) firstTouch = Date.now(); }, { once: false });

    // Validate on blur, and clear the error as soon as the field becomes valid.
    $$('input[name="name"], input[name="phone"], input[name="email"]', form).forEach(function (input) {
      input.addEventListener('blur', function () { if (input.value) validateField(input); });
      input.addEventListener('input', function () {
        if (input.getAttribute('aria-invalid') === 'true') validateField(input);
      });
    });

    // Budget radios clear their own error group on change.
    $$('input[name="budget"]', form).forEach(function (radio) {
      radio.addEventListener('change', function () {
        var slot = form.querySelector('[data-err-for$="-budget"]');
        if (slot) slot.textContent = '';
      });
    });

    form.addEventListener('submit', function (e) {
      e.preventDefault();

      // Honeypot: a bot fills every field it finds.
      if (form.company && form.company.value) { track('lead_blocked_honeypot', { form: formName }); return; }

      // Time trap: submitted implausibly fast after first keystroke.
      if (firstTouch && Date.now() - firstTouch < 1500) {
        track('lead_blocked_timetrap', { form: formName });
        return;
      }

      var problems = [];   // { id, label, message } for the summary

      $$('input[required]', form).forEach(function (input) {
        if (input.type === 'radio') return;
        var message = '';
        if (!input.value.trim()) {
          message = 'This field is required.';
          setError(input, message);
        } else if (!validateField(input)) {
          var slotEl = document.querySelector('[data-err-for="' + input.id + '"]');
          message = slotEl ? slotEl.textContent : 'Check this field.';
        }
        if (message) problems.push({ id: input.id, label: labelFor(input), message: message });
      });

      var budgets = $$('input[name="budget"]', form);
      if (budgets.length && !budgets.some(function (b) { return b.checked; })) {
        var budgetSlot = form.querySelector('[data-err-for$="-budget"]');
        if (budgetSlot) budgetSlot.textContent = 'Please pick a budget range.';
        problems.push({ id: budgets[0].id, label: 'Budget range', message: 'Please pick a budget range.' });
      }

      if (problems.length) {
        showSummary(form, problems);
        track('lead_validation_failed', { form: formName, fields: problems.length });
        return;
      }
      clearSummary(form);

      var btn = form.querySelector('button[type="submit"]');
      var originalHtml = btn ? btn.innerHTML : '';
      if (btn) { btn.disabled = true; btn.textContent = 'Sending…'; }

      var data = {};
      new FormData(form).forEach(function (value, key) { if (key !== 'company') data[key] = value; });
      data.form = formName;
      data.page = location.pathname;

      track('lead_submit', { form: formName, budget: data.budget || null });

      sendLead(data)
        .then(function () {
          // Only reached when the endpoint confirmed the write.
          form.classList.add('is-sent');
          clearFailure(form);
          track('lead_success', { form: formName, budget: data.budget || null });
          var success = form.nextElementSibling;
          if (success && success.classList.contains('form-success')) {
            success.setAttribute('tabindex', '-1');
            success.focus({ preventScroll: true });
          }
        })
        .catch(function (err) {
          if (btn) { btn.disabled = false; btn.innerHTML = originalHtml; }
          stashFailedLead(data);
          /* No endpoint configured is not the same as a broken endpoint. In
             that case WhatsApp IS the delivery channel, so present it as the
             next step rather than as a fault. */
          if (err && err.unconfigured) showWhatsAppHandoff(form, data);
          else showFailure(form, data, err);
          track('lead_error', {
            form: formName,
            reason: err && err.unconfigured ? 'unconfigured' : (err && err.status ? 'http_' + err.status : 'network')
          });
        });
    });
  });

  /* No endpoint yet — so WhatsApp is the endpoint. The visitor has already
     done the work of filling the form; this carries every field across into a
     pre-written message so they only have to press send. Framed as the next
     step, not an error, because from their side nothing has gone wrong. */
  function showWhatsAppHandoff(form, data) {
    var box = form.querySelector('[data-send-failure]');
    if (!box) {
      box = document.createElement('div');
      box.setAttribute('data-send-failure', '');
      box.setAttribute('tabindex', '-1');
      form.insertBefore(box, form.firstChild);
    }
    box.className = 'form-errors handoff';
    box.setAttribute('role', 'status');
    box.innerHTML = '';

    var title = document.createElement('p');
    title.className = 'form-errors__title';
    title.textContent = 'One last step';
    box.appendChild(title);

    var body = document.createElement('p');
    body.className = 'small';
    body.style.marginTop = '6px';
    body.textContent = 'Your details are ready to send. Tap below and WhatsApp opens with everything '
                     + 'filled in — just press send, and an analyst replies within 2 working hours.';
    box.appendChild(body);

    var row = document.createElement('div');
    row.className = 'send-failure__actions';

    var waBtn = document.createElement('a');
    waBtn.className = 'btn btn--primary';
    waBtn.href = whatsappFallback(data);
    waBtn.target = '_blank';
    waBtn.rel = 'noopener';
    waBtn.textContent = 'Send on WhatsApp →';
    waBtn.setAttribute('data-cta', 'handoff-whatsapp');
    waBtn.addEventListener('click', function () { track('lead_handoff_whatsapp', { form: form.dataset.form }); });
    row.appendChild(waBtn);

    var telBtn = document.createElement('a');
    telBtn.className = 'btn btn--ghost';
    telBtn.href = 'tel:' + LEAD_CONFIG.phone.replace(/\s/g, '');
    telBtn.textContent = 'Call instead';
    telBtn.setAttribute('data-cta', 'handoff-call');
    row.appendChild(telBtn);

    box.appendChild(row);
    box.hidden = false;
    box.focus();
  }

  /* The submit failed. Say so plainly, keep everything they typed, and give
     them a one-tap route that carries their details across. */
  function showFailure(form, data, err) {
    var box = form.querySelector('[data-send-failure]');
    if (!box) {
      box = document.createElement('div');
      box.className = 'form-errors send-failure';
      box.setAttribute('data-send-failure', '');
      box.setAttribute('role', 'alert');
      box.setAttribute('tabindex', '-1');
      form.insertBefore(box, form.firstChild);
    }

    var wa = whatsappFallback(data);
    box.innerHTML = '';

    var title = document.createElement('p');
    title.className = 'form-errors__title';
    title.textContent = "We couldn't send that just now";
    box.appendChild(title);

    var body = document.createElement('p');
    body.className = 'small';
    body.style.marginTop = '6px';
    body.textContent = 'Your details are still here, so nothing is lost. Send them over WhatsApp instead, '
                     + 'or call us on ' + LEAD_CONFIG.phone + ' — either reaches the same team.';
    box.appendChild(body);

    var row = document.createElement('div');
    row.className = 'send-failure__actions';

    var waBtn = document.createElement('a');
    waBtn.className = 'btn btn--primary';
    waBtn.href = wa;
    waBtn.target = '_blank';
    waBtn.rel = 'noopener';
    waBtn.textContent = 'Send on WhatsApp';
    waBtn.setAttribute('data-cta', 'fallback-whatsapp');
    row.appendChild(waBtn);

    var telBtn = document.createElement('a');
    telBtn.className = 'btn btn--ghost';
    telBtn.href = 'tel:' + LEAD_CONFIG.phone.replace(/\s/g, '');
    telBtn.textContent = 'Call instead';
    telBtn.setAttribute('data-cta', 'fallback-call');
    row.appendChild(telBtn);

    box.appendChild(row);
    box.hidden = false;
    box.focus();

    if (err && err.unconfigured && window.EVO_DEBUG !== false) {
      console.warn('[EVO] Set LEAD_CONFIG.provider + credentials in main.js to start capturing leads.');
    }
  }

  function clearFailure(form) {
    var box = form.querySelector('[data-send-failure]');
    if (box) box.remove();
  }

  /* ----------------------------------------------------------------- scrollspy
     Marks the nav link for the section currently in view with aria-current, so
     location is conveyed to both sighted and screen-reader users. Picks the
     entry closest to the top of the viewport rather than the first match, so
     short sections don't win over the one actually being read. */
  var spyLinks = $$('.nav a[href^="#"]');
  if (spyLinks.length && 'IntersectionObserver' in window) {
    var linkFor = {};
    var sections = [];

    spyLinks.forEach(function (a) {
      var id = a.getAttribute('href').slice(1);
      var section = document.getElementById(id);
      if (!section) return;
      linkFor[id] = a;
      sections.push(section);
    });

    var visible = {};

    function syncSpy() {
      var best = null;
      sections.forEach(function (s) {
        if (!visible[s.id]) return;
        var top = s.getBoundingClientRect().top;
        if (best === null || Math.abs(top) < Math.abs(best.top)) best = { id: s.id, top: top };
      });
      spyLinks.forEach(function (a) { a.removeAttribute('aria-current'); });
      if (best && linkFor[best.id]) linkFor[best.id].setAttribute('aria-current', 'true');
    }

    var spyIo = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) { visible[entry.target.id] = entry.isIntersecting; });
      syncSpy();
    }, { rootMargin: '-20% 0px -70% 0px', threshold: 0 });

    sections.forEach(function (s) { spyIo.observe(s); });
  }

  /* -------------------------------------------------------- scroll depth (CRO)
     Fires once per threshold. Useful for spotting where the page loses people. */
  var depths = [25, 50, 75, 100];
  var hit = {};
  var ticking = false;

  function checkDepth() {
    var doc = document.documentElement;
    var max = doc.scrollHeight - window.innerHeight;
    var pct = max > 0 ? ((window.scrollY / max) * 100) : 100;
    depths.forEach(function (d) {
      if (!hit[d] && pct >= d) { hit[d] = true; track('scroll_depth', { depth: d }); }
    });
    ticking = false;
  }

  window.addEventListener('scroll', function () {
    if (!ticking) { ticking = true; requestAnimationFrame(checkDepth); }
  }, { passive: true });
})();
