// Compatibility for links produced when Mio occupied /lab/.
// An ordinary visit stays on the project directory; only old Mio links move.
(() => {
  const current = new URL(location.href);
  if (!/^\/lab(?:\/(?:index\.html)?)?$/.test(current.pathname)) return;
  if (!current.searchParams.has('work') && current.hash !== '#signed-in' && !current.hash.startsWith('#auth_error=')) return;
  current.pathname = '/lab/mio/';
  location.replace(current.href);
})();
