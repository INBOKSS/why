// Close the header drop-downs on an outside click, on Escape and when another opens.
(() => {
  const menus = [...document.querySelectorAll('.ix-header details')];
  const closeAll = except => menus.forEach(d => { if (d !== except) d.open = false; });
  menus.forEach(d => d.addEventListener('toggle', () => { if (d.open) closeAll(d); }));
  document.addEventListener('click', e => { if (!e.target.closest('.ix-header details')) closeAll(); });
  document.addEventListener('keydown', e => {
    if (e.key !== 'Escape') return;
    const open = menus.find(d => d.open);
    if (open) { open.open = false; open.querySelector('summary').focus(); }
  });
})();
