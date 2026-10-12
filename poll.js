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
    status.textContent = 'Please allow browser storage to save and update your vote. You can still preview the themes.';
    submit.disabled = true;
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
    submit.textContent = submitted ? 'Update vote' : 'Submit vote';
    form.querySelectorAll('select').forEach(input => input.disabled = busy);
    document.querySelectorAll('.theme-vote').forEach(input => input.disabled = busy);
    document.getElementById('vote-notice').textContent = submitted ? 'You have already voted. Submitting again will replace your previous vote, not add another one.' : 'You can update your vote later from this browser. Each submission replaces any previous vote from this browser.';
  }
  document.querySelectorAll('.theme-vote').forEach(input => input.addEventListener('change', update));
  if (submitted) {
    document.querySelectorAll('.theme-vote').forEach(input => input.checked = Array.isArray(identity.choices) && identity.choices.includes(input.value));
    form.elements.age.value = identity.age || '';
    form.elements.gender.value = identity.gender || '';
    status.textContent = Array.isArray(identity.choices) ? 'Your last saved choices are selected. You can change them and update your vote.' : 'A previous vote is saved. Select at least one theme in every group to replace it.';
  }
  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (!identity || busy) return;
    const missing = [...document.querySelectorAll('.family')].filter(group => !group.querySelector('.theme-vote:checked'));
    if (missing.length) {
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
    status.textContent = submitted ? 'Updating your previous vote…' : 'Submitting your vote…';
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
      if (result !== 'accepted') throw new Error('Unexpected response');
      identity.submitted = true;
      identity.choices = payload.p_choices;
      identity.age = payload.p_age_group;
      identity.gender = payload.p_gender;
      const wasSubmitted = submitted;
      submitted = true;
      try { localStorage.setItem(storageKey, JSON.stringify(identity)); } catch { /* The server keeps one response for this identifier. */ }
      status.textContent = wasSubmitted ? 'Thank you! Your previous vote has been replaced with these choices.' : 'Thank you! Your vote has been saved. Any previous vote from this browser has been replaced. You can change your choices and update it anytime.';
    } catch {
      status.textContent = 'We could not confirm your vote. Please try again. Retrying will not count the same submission twice.';
    } finally {
      busy = false;
      update();
    }
  });
  update();
})();
