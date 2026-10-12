(() => {
  'use strict';
  const form = document.getElementById('vote-form');
  const status = document.getElementById('vote-status');
  const submit = document.getElementById('submit-vote');
  const storageKey = 'webmail-theme-poll-v1';
  let identity, submitted = false, busy = false;
  const choices = () => [...document.querySelectorAll('.theme-vote:checked')].map(input => input.value);
  try {
    identity = JSON.parse(localStorage.getItem(storageKey) || 'null');
    if (!identity || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(identity.id || '')) identity = { id: crypto.randomUUID(), submitted: false };
    localStorage.setItem(storageKey, JSON.stringify(identity));
    submitted = identity.submitted === true;
  } catch {
    identity = null;
    status.textContent = 'Please allow browser storage to submit once from this browser. You can still preview the themes.';
    submit.disabled = true;
  }
  function update() {
    const selected = choices();
    document.getElementById('vote-count').textContent = selected.length + (selected.length === 1 ? ' theme selected' : ' themes selected');
    document.querySelectorAll('.family').forEach(group => {
      const count = group.querySelectorAll('.theme-vote:checked').length;
      group.querySelector('.family-count').textContent = count + ' selected';
    });
    document.querySelectorAll('.theme-option').forEach(card => card.classList.toggle('voted', card.querySelector('input').checked));
    submit.disabled = !identity || submitted || busy || selected.length === 0;
  }
  function lock() {
    submitted = true;
    form.querySelectorAll('select').forEach(input => input.disabled = true);
    document.querySelectorAll('.theme-vote').forEach(input => input.disabled = true);
    submit.textContent = 'Vote submitted';
    update();
  }
  document.querySelectorAll('.theme-vote').forEach(input => input.addEventListener('change', update));
  if (submitted) {
    status.textContent = 'Thank you! A vote has already been submitted from this browser. You can keep previewing themes.';
    lock();
  }
  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (!identity || submitted || busy || !choices().length) return;
    const config = window.THEME_POLL_CONFIG || {};
    if (!/^https:\/\/[a-z0-9]+\.supabase\.co$/.test(config.supabaseUrl || '') || !config.publishableKey) {
      status.textContent = 'Voting is not open yet. Your selections have not been submitted. Please try again later.';
      return;
    }
    const missing = [...document.querySelectorAll('.family')].filter(group => !group.querySelector('.theme-vote:checked')).map(group => group.dataset.family);
    if (missing.length && !document.getElementById('partial-confirm').checked) {
      document.getElementById('partial-choice').hidden = false;
      document.getElementById('partial-text').textContent = 'No selection in ' + missing.join(', ') + '. We recommend at least one theme in every group. You may still submit your current choices.';
      status.textContent = 'Choose more themes or tick “Submit with these groups left empty” below.';
      document.getElementById('partial-confirm').focus();
      return;
    }
    busy = true;
    update();
    status.textContent = 'Submitting your vote…';
    const payload = {
      p_voter_id: identity.id,
      p_choices: choices(),
      p_age_group: form.elements.age.value || null,
      p_gender: form.elements.gender.value || null
    };
    try {
      // Save the identifier before sending so a retry uses the same idempotency key.
      localStorage.setItem(storageKey, JSON.stringify(identity));
      const response = await fetch(config.supabaseUrl + '/rest/v1/rpc/submit_theme_vote', {
        method: 'POST',
        headers: { apikey: config.publishableKey, 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(20000)
      });
      if (!response.ok) throw new Error('Submission failed');
      const result = await response.json();
      if (result !== 'accepted' && result !== 'already_submitted') throw new Error('Unexpected response');
      identity.submitted = true;
      try { localStorage.setItem(storageKey, JSON.stringify(identity)); } catch { /* Server still rejects this identifier on retry. */ }
      lock();
      status.textContent = result === 'accepted' ? 'Thank you! Your vote has been saved. You can keep previewing themes.' : 'Thank you! A vote has already been saved from this browser.';
    } catch {
      status.textContent = 'We could not confirm your vote. Please try again. Retrying will not count the same submission twice.';
    } finally {
      busy = false;
      update();
    }
  });
  update();
})();
