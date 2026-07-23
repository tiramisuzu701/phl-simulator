/* PHL Franchise Simulator — themed toast notifications
 * Global namespace: window.PHLToast
 *
 * A quick, non-blocking overlay that matches the rest of the UI's dark
 * "glow" styling, used in place of the browser's native alert() popup for
 * one-way informational messages (trade/contract/promotion outcomes,
 * blocked moves, save confirmations, etc.). Yes/No decisions still use the
 * native confirm() dialog (release a player, delete a team, reset data) —
 * those need a real answer, not a heads-up.
 *
 * This module also overrides window.alert itself, so every existing
 * alert("...") call site across the app (js/trades.js, js/contracts.js,
 * js/promotions.js, and the rest) automatically renders as a themed toast
 * instead of a native modal, with zero call-site changes needed.
 */
(function () {
  "use strict";
  var stack = null;
  var seq = 0;

  function ensureStack() {
    if (stack && document.body && document.body.contains(stack)) return stack;
    stack = document.createElement("div");
    stack.className = "toast-stack";
    document.body.appendChild(stack);
    return stack;
  }

  function show(message, opts) {
    opts = opts || {};
    if (!document.body) return null; // called before DOM is ready — nothing to attach to
    var el = document.createElement("div");
    el.className = "toast" + (opts.variant ? " toast-" + opts.variant : "");
    el.id = "toast-" + (++seq);
    el.innerHTML = '<span class="toast-message"></span><button type="button" class="toast-close" aria-label="Dismiss">&times;</button>';
    el.querySelector(".toast-message").textContent = String(message == null ? "" : message);

    var dismissTimer = null;
    function dismiss() {
      if (dismissTimer) clearTimeout(dismissTimer);
      el.classList.remove("toast-in");
      el.classList.add("toast-hide");
      setTimeout(function () {
        if (el.parentNode) el.parentNode.removeChild(el);
      }, 220);
    }
    el.querySelector(".toast-close").addEventListener("click", dismiss);

    ensureStack().appendChild(el);
    // Force a reflow before adding the "in" class so the CSS transition
    // actually plays instead of snapping straight to its end state.
    void el.offsetWidth;
    el.classList.add("toast-in");

    var duration = opts.duration != null ? opts.duration : 6000;
    if (duration > 0) dismissTimer = setTimeout(dismiss, duration);
    return { dismiss: dismiss };
  }

  // Drop-in replacement for the native window.alert — same one-argument
  // call signature every existing call site already uses, but renders as a
  // themed, non-blocking corner toast instead of halting the page behind a
  // native modal. window.confirm is left untouched on purpose.
  window.alert = function (message) {
    show(message, { variant: "info" });
  };

  window.PHLToast = { show: show };
})();
