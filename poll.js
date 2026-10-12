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
    delete identity.choices;
    delete identity.age;
    delete identity.gender;
    localStorage.setItem(storageKey, JSON.stringify(identity));
    submitted = identity.submitted === true;
  } catch {
    identity = null;
    status.textContent = 'Please allow browser storage to save votes and group submissions from this browser. You can still preview the themes.';
    submit.disabled = true;
  }
  function clearForm() {
    document.querySelectorAll('.theme-vote').forEach(input => input.checked = false);
    form.elements.age.value = '';
    form.elements.gender.value = '';
  }
  function update() {
    const selected = choices();
    document.getElementById('vote-count').textContent = selected.length + (selected.length === 1 ? ' theme selected' : ' themes selected');
    document.querySelectorAll('.family').forEach(group => {
      const count = group.querySelectorAll('.theme-vote:checked').length;
      group.querySelector('.family-count').textContent = count ? count + ' selected' : 'Choose at least 1';
      if (count) group.classList.remove('missing-choice');
    });
    document.querySelectorAll('.theme-option').forEach(card => card.classList.toggle('voted', card.querySelector('input').checked));
    submit.disabled = !identity || busy;
    submit.textContent = identity && identity.pending ? 'Retry submission' : submitted ? 'Submit another vote' : 'Submit vote';
    form.querySelectorAll('select').forEach(input => input.disabled = busy || !!(identity && identity.pending));
    document.querySelectorAll('.theme-vote').forEach(input => input.disabled = busy || !!(identity && identity.pending));
    const count = identity && identity.voteCount;
    document.getElementById('vote-notice').textContent = (Number.isInteger(count) && count > 0 ? 'Saved votes from this browser: ' + count + '. ' : submitted ? 'Earlier votes from this browser are saved. ' : '') + 'You may vote more than once. Each new submission adds a separate vote; previous votes remain saved. We group votes using a browser identifier.';
  }
  document.querySelectorAll('.theme-vote').forEach(input => input.addEventListener('change', update));
  clearForm();
  if (identity && (submitted || identity.pending)) {
    status.textContent = identity.pending ? 'Your last submission has not been confirmed. Retry will resend that saved submission without selecting its choices here. It will not be counted twice.' : 'A fresh form is ready for the next voter. Previous votes remain saved.';
  }
  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (!identity || busy) return;
    const missing = [...document.querySelectorAll('.family')].filter(group => !group.querySelector('.theme-vote:checked'));
    if (missing.length && !identity.pending) {
      missing.forEach(group => group.classList.add('missing-choice'));
      status.textContent = 'Select at least one theme in every group. Still needed: ' + missing.map(group => group.dataset.family).join(', ') + '.';
      missing[0].querySelector('.theme-vote').focus();
      return;
    }
    const config = window.THEME_POLL_CONFIG || {};
    if (!/^https:\/\/[a-z0-9]+\.supabase\.co$/.test(config.supabaseUrl || '') || !config.publishableKey) {
      status.textContent = 'Voting is not open yet. Your selections have not been submitted. Please try again later.';
      return;
    }
    busy = true;
    update();
    status.textContent = 'Submitting your vote…';
    const payload = identity.pending || {
      p_voter_id: identity.id,
      p_submission_id: crypto.randomUUID(),
      p_choices: choices(),
      p_age_group: form.elements.age.value || null,
      p_gender: form.elements.gender.value || null
    };
    try {
      // Persist the complete pending submission. Retries and reloads reuse its ID.
      identity.pending = payload;
      localStorage.setItem(storageKey, JSON.stringify(identity));
      const response = await fetch(config.supabaseUrl + '/rest/v1/rpc/record_theme_vote', {
        method: 'POST',
        headers: { apikey: config.publishableKey, 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(20000)
      });
      if (!response.ok) throw new Error('Submission failed');
      const result = await response.json();
      if (!Number.isInteger(result) || result < 1) throw new Error('Unexpected response');
      identity.submitted = true;
      identity.voteCount = result;
      delete identity.pending;
      submitted = true;
      clearForm();
      try { localStorage.setItem(storageKey, JSON.stringify(identity)); } catch { /* A restored pending submission is still safe to retry. */ }
      status.textContent = 'Thank you! Vote #' + result + ' from this browser has been saved. The form is cleared and ready for the next voter. Previous votes remain saved.';
    } catch {
      status.textContent = 'We could not confirm your vote. Retry this submission before changing your choices. Retrying will not count the same submission twice.';
    } finally {
      busy = false;
      update();
    }
  });
  update();
})();
