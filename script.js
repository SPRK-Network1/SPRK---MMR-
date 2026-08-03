/* ═══════════════════════════════════════════════════════════
   SPRK NETWORK — BEHAVIOUR
   Progressive enhancement only. Nothing here is required for
   the page to read, and every block fails soft if its markup
   is absent. Loaded with `defer`.
   ═══════════════════════════════════════════════════════════ */

(function () {
  'use strict';

  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ── 01 · Footer year ─────────────────────────────────── */

  var year = document.getElementById('year');
  if (year) year.textContent = new Date().getFullYear();


  /* ── 02 · Nav · materialise the pill once scrolled ────── */

  var nav = document.querySelector('.nav');
  if (nav) {
    var applyNavState = function () {
      /* must match the [data-state="scrolled"] selector in styles.css */
      nav.dataset.state = window.scrollY > 24 ? 'scrolled' : 'rest';
    };
    applyNavState();
    window.addEventListener('scroll', applyNavState, { passive: true });
  }


  /* ── 03 · Sticky CTA bar ──────────────────────────────────
     Slides up once the stage CTA has scrolled away, and retracts
     again over the closing CTA so the two never stack. Kept off
     the focus order and out of the a11y tree while hidden — a
     fixed bar you cannot see should not be tabbable. */

  var stickybar = document.querySelector('.stickybar');
  var stageActions = document.querySelector('.stage__actions');
  var closeSection = document.querySelector('.close');

  if (stickybar && stageActions) {
    var stickyLink = stickybar.querySelector('a');

    var setSticky = function (shown) {
      if ((stickybar.dataset.state === 'shown') === shown) return;

      /* The bar hides via transform + pointer-events, never display or
         visibility, so the browser will not blur a focused child on its
         own — and tabIndex = -1 does not blur an already-focused node.
         Without this, focus can sit inside an aria-hidden subtree that
         is off-screen, and the screen reader announces nothing. */
      if (!shown && stickybar.contains(document.activeElement)) {
        document.activeElement.blur();
      }

      stickybar.dataset.state = shown ? 'shown' : 'hidden';
      stickybar.setAttribute('aria-hidden', shown ? 'false' : 'true');
      if (stickyLink) stickyLink.tabIndex = shown ? 0 : -1;
    };

    var syncSticky = function () {
      var pastStage = stageActions.getBoundingClientRect().bottom < 0;
      /* the closing CTA makes the bar redundant */
      var atClose = closeSection
        ? closeSection.getBoundingClientRect().top < window.innerHeight * 0.9
        : false;
      setSticky(pastStage && !atClose);
    };

    syncSticky();
    window.addEventListener('scroll', syncSticky, { passive: true });
    window.addEventListener('resize', syncSticky, { passive: true });
  }


  /* ── 04 · Reveal on scroll ────────────────────────────── */

  var revealables = document.querySelectorAll('.reveal');

  if (!revealables.length) {
    /* nothing to do */
  } else if (reduceMotion || !('IntersectionObserver' in window)) {
    /* No observer (or the user opted out) — show everything immediately
       so content is never trapped at opacity 0. */
    Array.prototype.forEach.call(revealables, function (el) {
      el.classList.add('is-in');
    });
  } else {
    var showAll = function () {
      Array.prototype.forEach.call(revealables, function (el) {
        el.classList.add('is-in');
      });
    };

    /* threshold 0.01, not 0.12: an element taller than the viewport can
       never reach a large visible-fraction, and a throttled tab can drop
       intermediate entries entirely. Fire on the first visible pixel. */
    var observerFired = false;

    var revealObserver = new IntersectionObserver(function (entries, obs) {
      observerFired = true;
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-in');
        obs.unobserve(entry.target);
      });
    }, { threshold: 0.01, rootMargin: '0px 0px -10% 0px' });

    Array.prototype.forEach.call(revealables, function (el) {
      revealObserver.observe(el);
    });

    /* Failsafe. Copy that is merely un-animated is fine; copy that is
       invisible is a broken page.

       Conditional on the observer never having delivered ANYTHING. The
       previous version called showAll() unconditionally on a timer, so
       on a VSL page — where visitors sit on the hero for minutes — every
       section below the fold transitioned in while off-screen and had
       already finished by the time it was scrolled to. The observer was
       effectively dead code for normal visitors. Now it only takes over
       when the observer is genuinely not working. */
    var failsafe = function () {
      if (observerFired) return;
      showAll();
    };

    setTimeout(failsafe, 2500);
    window.addEventListener('load', function () { setTimeout(failsafe, 1200); });
  }


  /* ── 05 · Scroll-snap rails (mobile) ──────────────────────
     The track is a real scroll container (CSS does the snapping),
     so touch gets native momentum and rubber-banding, and the rail
     still works with JS disabled. This only wires the dots:
     tap a dot to scroll, and light the dot the user scrolled to.

     Markup contract:
       <div class="rail" data-rail>
         <div data-rail-track> …slides… </div>
         <div class="dots" data-rail-dots></div>
       </div>
     Dots are generated from the slide count, so adding a card to
     the HTML never desynchronises the pagination.
     ──────────────────────────────────────────────────────── */

  /* Must stay in lockstep with the rail breakpoint in styles.css
     (@media max-width: 60rem). If these drift apart there is a band of
     widths where CSS renders a scroll rail but JS refuses to drive it. */
  var MOBILE = '(max-width: 60rem)';

  function initRail(rail) {
    var track = rail.querySelector('[data-rail-track]');
    var dotWrap = rail.querySelector('[data-rail-dots]');
    if (!track) return;

    var slides = Array.prototype.filter.call(track.children, function (n) {
      return n.nodeType === 1;
    });
    if (slides.length < 2) return;

    var dots = [];

    /* Distance from the track's scroll origin to slide i. Measured
       from live rects so it stays correct whatever the gap, padding
       or card width resolve to at this breakpoint. */
    function offsetOf(i) {
      var pad = parseFloat(getComputedStyle(track).paddingLeft) || 0;
      var slideLeft = slides[i].getBoundingClientRect().left;
      var trackLeft = track.getBoundingClientRect().left;
      return track.scrollLeft + (slideLeft - trackLeft) - pad;
    }

    function scrollToSlide(i) {
      if (!window.matchMedia(MOBILE).matches) return;
      track.scrollTo({
        left: offsetOf(i),
        behavior: reduceMotion ? 'auto' : 'smooth'
      });
    }

    function activeIndex() {
      var best = 0;
      var bestDist = Infinity;
      for (var i = 0; i < slides.length; i++) {
        var d = Math.abs(offsetOf(i) - track.scrollLeft);
        if (d < bestDist) { bestDist = d; best = i; }
      }
      return best;
    }

    function paintDots() {
      var active = activeIndex();
      for (var i = 0; i < dots.length; i++) {
        dots[i].classList.toggle('is-active', i === active);
        dots[i].setAttribute('aria-current', i === active ? 'true' : 'false');
      }
    }

    if (dotWrap) {
      dotWrap.innerHTML = '';
      slides.forEach(function (_, i) {
        var b = document.createElement('button');
        b.type = 'button';
        b.className = 'dot' + (i === 0 ? ' is-active' : '');
        b.setAttribute('aria-label', 'Go to item ' + (i + 1) + ' of ' + slides.length);
        b.addEventListener('click', function () { scrollToSlide(i); });
        dotWrap.appendChild(b);
        dots.push(b);
      });
    }

    /* Repaint at most once per frame while the finger is moving.
       Deliberately NOT gated on a "queued" boolean that only rAF can
       clear: rAF is frozen in background tabs and throttled in iOS
       low-power mode, so such a flag can latch on forever and the dots
       silently stop tracking. Cancel-and-reschedule can't get stuck,
       and the timeout is a safety net for when rAF isn't running. */
    var raf = 0;
    var settle = 0;

    function schedulePaint() {
      if (raf) cancelAnimationFrame(raf);
      raf = requestAnimationFrame(function () {
        raf = 0;
        paintDots();
      });
      clearTimeout(settle);
      settle = setTimeout(paintDots, 140);
    }

    track.addEventListener('scroll', schedulePaint, { passive: true });
    /* Fires once the momentum fling finally stops (Safari 17+, Chrome 114+) */
    track.addEventListener('scrollend', paintDots);

    var resizeTimer;
    window.addEventListener('resize', function () {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(function () {
        /* Crossing back to desktop the track is a grid again and is
           no longer scrollable — rewind so it isn't left mid-rail. */
        if (!window.matchMedia(MOBILE).matches) track.scrollLeft = 0;
        paintDots();
      }, 120);
    });

    paintDots();
  }

  Array.prototype.forEach.call(document.querySelectorAll('[data-rail]'), initRail);


  /* ── 06 · Wins marquee · clone once for a seamless loop ──
     The track animates to translateX(-50%), so the content has
     to appear exactly twice. Clones are aria-hidden and made
     non-focusable so screen readers see each win only once. */

  /* Skipped under reduced motion: the CSS there stops the animation and
     turns the band into a hand-scrolled rail, so the clones stop being a
     seamless-loop mechanism and just make the reader scroll past all 17
     wins twice. Queried live rather than using the flag sampled at load,
     so a mid-session OS change is respected. */
  var winsTrack = document.getElementById('wins-track');
  if (winsTrack && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    var originals = Array.prototype.slice.call(winsTrack.children);
    originals.forEach(function (node) {
      var clone = node.cloneNode(true);
      clone.setAttribute('aria-hidden', 'true');
      Array.prototype.forEach.call(clone.querySelectorAll('img'), function (img) {
        img.setAttribute('alt', '');
      });
      winsTrack.appendChild(clone);
    });
  }


  /* ── 07 · FAQ · one panel open at a time ──────────────── */

  var faqItems = document.querySelectorAll('.faq__item');
  Array.prototype.forEach.call(faqItems, function (item) {
    item.addEventListener('toggle', function () {
      if (!item.open) return;
      Array.prototype.forEach.call(faqItems, function (other) {
        if (other !== item) other.open = false;
      });
    });
  });

})();
