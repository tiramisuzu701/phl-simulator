/* PHL Franchise Simulator — forced negotiation counter-offer modal
 * Global namespace: window.PHLNegotiationModal
 *
 * Deliberately distinct from js/boxscoreModal.js: there is NO outside-click
 * -to-close and NO Escape-to-close here. When an AI team counter-offers a
 * contract or a trade, the human GM has to resolve it via one of the
 * buttons in this modal — that's the "forceful" pop-up the user asked for.
 * Reuses the same .modal-overlay/.modal-box CSS as the box score modal so
 * it looks consistent, just without the dismiss affordances.
 */
(function () {
  "use strict";
  var U = window.PHLUtil;
  var overlayEl = null;

  function close() {
    if (overlayEl && overlayEl.parentNode) overlayEl.parentNode.removeChild(overlayEl);
    overlayEl = null;
  }

  function showRaw(opts) {
    close(); // only one negotiation modal at a time
    overlayEl = document.createElement("div");
    overlayEl.className = "modal-overlay modal-overlay-forced";
    overlayEl.innerHTML =
      '<div class="modal-box">' +
      '<div class="modal-box-header"><h3>' + U.escapeHtml(opts.title) + "</h3></div>" +
      '<div class="modal-box-body">' + opts.bodyHtml + "</div>" +
      "</div>";
    document.body.appendChild(overlayEl);
    // No overlay-click-to-close listener here on purpose — see file header.
    return overlayEl.querySelector(".modal-box");
  }

  // ---- Contract counter-offer ----
  // The AI has countered a lowball offer instead of flatly rejecting it.
  // opts: { playerName, asking, originalOffer, counterOffer, years,
  //         onCounterBack(amount), onKeepOriginal(), onDrop() }
  function showContractCounter(opts) {
    var body = "<p>" + U.escapeHtml(opts.playerName) + " won't sign for " + U.formatMoney(opts.originalOffer) +
      " over " + opts.years + " yr" + (opts.years > 1 ? "s" : "") + " (asking " + U.formatMoney(opts.asking) +
      "), but their agent will talk. Counter-offer: <strong>" + U.formatMoney(opts.counterOffer) + "</strong>.</p>";
    body += '<p class="muted small">Meet or beat their counter and the deal is done. Come in under it and there\'s still a chance they say yes — just less of one.</p>';
    body += '<div class="offer-panel-grid"><label>Your counter<input type="number" id="neg-counter-amount" step="500" min="' + U.SALARY_MIN + '" value="' + opts.counterOffer + '"></label></div>';
    body += '<div class="form-actions">' +
      '<button class="btn btn-primary" data-neg="counter">Send Counter Offer</button>' +
      '<button class="btn" data-neg="keep">Keep My Original Offer (' + U.formatMoney(opts.originalOffer) + ")</button>" +
      '<button class="btn btn-danger" data-neg="drop">Drop Offer</button>' +
      "</div>";

    var box = showRaw({ title: "Contract Counter-Offer", bodyHtml: body });
    box.querySelector('[data-neg="counter"]').addEventListener("click", function () {
      var input = box.querySelector("#neg-counter-amount");
      var amount = Math.max(U.SALARY_MIN, parseInt(input.value, 10) || opts.counterOffer);
      close();
      opts.onCounterBack(amount);
    });
    box.querySelector('[data-neg="keep"]').addEventListener("click", function () {
      close();
      opts.onKeepOriginal();
    });
    box.querySelector('[data-neg="drop"]').addEventListener("click", function () {
      close();
      opts.onDrop();
    });
  }

  // ---- Trade counter-offer ----
  // The partner team won't take the offer as-is, but would if the user
  // sweetens it with one more (specific) player from their own roster.
  // opts: { aiTeamName, giveValue, getValue, sweetenerName, sweetenerBlurb,
  //         onAcceptCounter(), onCounterBack(), onDrop() }
  function showTradeCounter(opts) {
    var body = "<p>" + U.escapeHtml(opts.aiTeamName) + " won't accept that trade as-is — you're offering about " +
      opts.giveValue + " in value for about " + opts.getValue + ". They'll do it if you also include <strong>" +
      U.escapeHtml(opts.sweetenerName) + "</strong>" + (opts.sweetenerBlurb ? " (" + U.escapeHtml(opts.sweetenerBlurb) + ")" : "") + ".</p>";
    body += '<div class="form-actions">' +
      '<button class="btn btn-primary" data-neg="accept">Accept — Add ' + U.escapeHtml(opts.sweetenerName) + "</button>" +
      '<button class="btn" data-neg="counter">Offer a Different Player Instead</button>' +
      '<button class="btn btn-danger" data-neg="drop">Drop This Trade</button>' +
      "</div>";

    var box = showRaw({ title: "Trade Counter-Offer", bodyHtml: body });
    box.querySelector('[data-neg="accept"]').addEventListener("click", function () {
      close();
      opts.onAcceptCounter();
    });
    box.querySelector('[data-neg="counter"]').addEventListener("click", function () {
      close();
      opts.onCounterBack();
    });
    box.querySelector('[data-neg="drop"]').addEventListener("click", function () {
      close();
      opts.onDrop();
    });
  }

  window.PHLNegotiationModal = {
    showContractCounter: showContractCounter,
    showTradeCounter: showTradeCounter,
    close: close,
  };
})();
