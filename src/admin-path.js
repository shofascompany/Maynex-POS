// The platform admin opens  https://<site>/admin2026 . The app uses #-routes, and the hash router
// reads the address when it is created, so this must run before the router module is imported.
if (/^\/admin2026\/?$/i.test(location.pathname)) history.replaceState(null, '', '/#/admin2026')
