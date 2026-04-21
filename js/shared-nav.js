/* ================================================================
   SHARED NAV — scroll state · active links · mobile menu ·
                smooth anchors · fade-up on scroll
   ================================================================ */
(function () {
  'use strict';

  /* ── Scroll state on content-nav ─────────────────────── */
  const nav = document.querySelector('.content-nav');
  if (nav) {
    const tick = () => nav.classList.toggle('scrolled', window.scrollY > 4);
    window.addEventListener('scroll', tick, { passive: true });
    tick();
  }

  /* ── Active link (path-based) ─────────────────────────── */
  const path = window.location.pathname.replace(/\/$/, '') || '/';
  document.querySelectorAll('.nav-links a, .nav-drawer a').forEach(a => {
    try {
      const href = new URL(a.href, location.href).pathname.replace(/\/$/, '') || '/';
      if (href !== '/' && path.startsWith(href)) a.classList.add('active');
      else if (href === '/' && path === '/') a.classList.add('active');
    } catch (_) { /* ignore malformed hrefs */ }
  });

  /* ── Mobile menu toggle ───────────────────────────────── */
  const toggle = document.querySelector('.nav-toggle');
  const drawer = document.querySelector('.nav-drawer');
  if (toggle && drawer) {
    toggle.addEventListener('click', () => {
      const open = toggle.classList.toggle('open');
      drawer.classList.toggle('open', open);
      document.body.style.overflow = open ? 'hidden' : '';
    });
    drawer.querySelectorAll('a').forEach(a =>
      a.addEventListener('click', () => {
        toggle.classList.remove('open');
        drawer.classList.remove('open');
        document.body.style.overflow = '';
      })
    );
  }

  /* ── Smooth anchor scroll ─────────────────────────────── */
  document.querySelectorAll('a[href^="#"]').forEach(a =>
    a.addEventListener('click', function (e) {
      const target = document.querySelector(this.getAttribute('href'));
      if (!target) return;
      e.preventDefault();
      const navH = parseInt(
        getComputedStyle(document.documentElement).getPropertyValue('--nav-h')
      ) || 60;
      const top = target.getBoundingClientRect().top + window.scrollY - navH - 16;
      window.scrollTo({ top, behavior: 'smooth' });
    })
  );

  /* ── Fade-up on scroll (IntersectionObserver) ─────────── */
  const fadeEls = document.querySelectorAll('[data-fade]');
  if (fadeEls.length && 'IntersectionObserver' in window) {
    const io = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.style.animationPlayState = 'running';
          io.unobserve(entry.target);
        }
      });
    }, { threshold: 0.08 });

    fadeEls.forEach((el, i) => {
      el.classList.add('fade-up');
      el.style.animationDelay = (i * 0.07) + 's';
      el.style.animationPlayState = 'paused';
      io.observe(el);
    });
  }

  /* ── Project sidebar: highlight active section ────────── */
  const sidebarLinks = document.querySelectorAll('.proj-sidebar a');
  if (sidebarLinks.length) {
    const sections = Array.from(sidebarLinks)
      .map(a => document.querySelector(a.getAttribute('href')))
      .filter(Boolean);

    const highlight = () => {
      const offset = 90;
      const scrollY = window.scrollY + offset;
      let active = sections[0];
      sections.forEach(s => { if (s.offsetTop <= scrollY) active = s; });
      sidebarLinks.forEach(a =>
        a.classList.toggle('active', a.getAttribute('href') === '#' + active?.id)
      );
    };
    window.addEventListener('scroll', highlight, { passive: true });
    highlight();
  }

  /* ── Contact form: simple client-side feedback ────────── */
  const form = document.querySelector('.contact-form');
  if (form) {
    form.addEventListener('submit', e => {
      e.preventDefault();
      const btn = form.querySelector('button[type="submit"]');
      if (btn) {
        btn.textContent = 'Sent ✓';
        btn.disabled = true;
        setTimeout(() => { btn.textContent = 'Send message'; btn.disabled = false; }, 3500);
      }
    });
  }
})();
