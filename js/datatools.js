/* PHL Franchise Simulator — import/export/reset league data
 * Global namespace: window.PHLDataTools
 */
(function () {
  "use strict";
  var S = window.PHLState;
  var container = null;

  function render(el) {
    container = el || container;
    if (!container) return;
    var html = '<div class="panel-header"><h2>Data Tools</h2></div>';
    html += '<div class="form-card">';
    html += "<h3>Export League</h3>";
    html += '<p class="muted">Download the entire league (divisions, teams, players, schedule, standings, draft history) as a single JSON file. Commit this to your GitHub repo so others can load your league, or keep it as a save file.</p>';
    html += '<button class="btn btn-primary" data-action="export">Export League as JSON</button>';
    html += "</div>";

    html += '<div class="form-card">';
    html += "<h3>Import League</h3>";
    html += '<p class="muted">Load a previously exported league JSON file (yours, or one shared by someone else). This replaces everything currently in the browser.</p>';
    html += '<button class="btn" data-action="import">Import League JSON&hellip;</button>';
    html += "</div>";

    html += '<div class="form-card">';
    html += "<h3>Start a New Save</h3>";
    html += '<p class="muted">Wipe the current league and go pick a division/team (or create an Expansion Franchise) from scratch on the Create Save page.</p>';
    html += '<a class="btn btn-primary" href="create-save.html">Start a New Save&hellip;</a>';
    html += "</div>";

    html += '<div class="form-card">';
    html += "<h3>Reset</h3>";
    html += '<p class="muted">Wipe the current league and restore the starter PHL divisions/teams with no franchise chosen yet &mdash; you\'ll be sent to Create Save to pick one.</p>';
    html += '<button class="btn btn-danger" data-action="reset">Reset to Starter Data</button>';
    html += "</div>";

    html += '<div class="form-card">';
    html += "<h3>About this save</h3>";
    html += '<p class="muted small">Your league currently lives in this browser\'s local storage. It will stay here between visits on this device/browser, but it will <strong>not</strong> follow you to another computer or browser unless you export it and share/import the JSON file. To ship a specific starter league with the site itself (e.g. for a GitHub repo), replace the contents of <code>js/starterData.js</code> with an exported save.</p>';
    html += "</div>";

    container.innerHTML = html;
    wireEvents();
  }

  function wireEvents() {
    container.querySelector('[data-action="export"]').addEventListener("click", function () {
      S.exportJSON();
    });
    container.querySelector('[data-action="reset"]').addEventListener("click", function () {
      if (confirm("Reset everything to the starter PHL league? This cannot be undone (export first if you want to keep it).")) {
        S.resetToStarter();
        window.location.href = "create-save.html";
      }
    });
    container.querySelector('[data-action="import"]').addEventListener("click", function () {
      var input = document.getElementById("import-file-input");
      input.value = "";
      input.onchange = function () {
        var file = input.files[0];
        if (!file) return;
        var reader = new FileReader();
        reader.onload = function () {
          try {
            var obj = JSON.parse(reader.result);
            S.importFromObject(obj);
            alert("League imported successfully.");
            if (window.PHLApp) window.PHLApp.refreshAll();
          } catch (e) {
            alert("Couldn't import that file: " + e.message);
          }
        };
        reader.readAsText(file);
      };
      input.click();
    });
  }

  window.PHLDataTools = { render: render };
})();
