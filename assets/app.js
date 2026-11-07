/* Corgi Talent Desk — validation + submission. No dependencies. */
(function () {
  "use strict";

  var PLACEHOLDER = "PASTE_YOUR_APPS_SCRIPT_WEB_APP_URL_HERE";
  var cfg = window.CORGI_TALENT_DESK || {};
  var endpoint = (cfg.ENDPOINT || "").trim();
  var configured = endpoint && endpoint !== PLACEHOLDER;

  var form = document.getElementById("form");
  var statusEl = document.getElementById("status");
  var submitBtn = document.getElementById("submit");
  var descEl = document.getElementById("job_description");
  var countEl = document.getElementById("count");
  var counterEl = countEl.parentElement;
  var doneEl = document.getElementById("done");

  if (!configured) {
    document.getElementById("notconfigured").hidden = false;
  }

  /* ---------- character counter ---------- */

  function updateCount() {
    var n = descEl.value.length;
    countEl.textContent = String(n);
    counterEl.classList.toggle("near", n > 1700 && n <= 2000);
    counterEl.classList.toggle("over", n > 2000);
  }
  descEl.addEventListener("input", updateCount);
  updateCount();

  /* ---------- validation ---------- */

  var RULES = {
    full_name: { label: "your name" },
    email: {
      label: "your email",
      test: function (v) { return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v); },
      bad: "That doesn't look like a valid email address."
    },
    company: { label: "your company name" },
    role_at_company: { label: "your role" },
    job_title: { label: "the job title" },
    location: { label: "a location" },
    job_description: {
      label: "a job description",
      test: function (v) { return v.length <= 2000; },
      bad: "Please keep the description to 2000 characters or fewer."
    },
    application_url: {
      label: "a link to the application",
      test: isHttpUrl,
      bad: "Please enter a full URL, starting with https://"
    }
  };

  function isHttpUrl(v) {
    try {
      var u = new URL(v);
      return (u.protocol === "https:" || u.protocol === "http:") && !!u.hostname && u.hostname.indexOf(".") > 0;
    } catch (e) {
      return false;
    }
  }

  function setError(name, message) {
    var el = document.querySelector('[data-error-for="' + name + '"]');
    var field = el && el.closest(".field");
    if (!el) return;
    el.textContent = message || "";
    el.classList.toggle("show", !!message);
    if (field) field.classList.toggle("invalid", !!message);
  }

  function validate() {
    var firstBad = null;

    Object.keys(RULES).forEach(function (name) {
      var input = form.elements[name];
      var rule = RULES[name];
      var value = (input.value || "").trim();
      var msg = "";

      if (!value) msg = "Please add " + rule.label + ".";
      else if (rule.test && !rule.test(value)) msg = rule.bad;

      setError(name, msg);
      if (msg && !firstBad) firstBad = input;
    });

    var consent = form.elements.consent;
    var consentMsg = consent.checked ? "" : "Please confirm the role is real before submitting.";
    setError("consent", consentMsg);
    if (consentMsg && !firstBad) firstBad = consent;

    return firstBad;
  }

  /* clear a field's error as soon as the person fixes it */
  Object.keys(RULES).concat(["consent"]).forEach(function (name) {
    var input = form.elements[name];
    if (!input) return;
    input.addEventListener("input", function () { setError(name, ""); });
    input.addEventListener("change", function () { setError(name, ""); });
  });

  /* ---------- submit ---------- */

  function payload() {
    var get = function (n) { return (form.elements[n].value || "").trim(); };
    return {
      full_name: get("full_name"),
      email: get("email"),
      company: get("company"),
      role_at_company: get("role_at_company"),
      job_title: get("job_title"),
      job_description: get("job_description"),
      location: get("location"),
      city: get("city"),
      work_type: get("work_type"),
      employment_type: get("employment_type"),
      salary_range: get("salary_range"),
      application_url: get("application_url"),
      deadline: get("deadline"),
      consent: form.elements.consent.checked,
      page_url: window.location.href
    };
  }

  function say(message, kind) {
    statusEl.textContent = message || "";
    statusEl.className = "status" + (kind ? " " + kind : "");
  }

  form.addEventListener("submit", function (event) {
    event.preventDefault();

    var bad = validate();
    if (bad) {
      say("Please fix the highlighted fields.", "err");
      bad.focus();
      bad.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }

    if (!configured) {
      say("This form isn't connected to a sheet yet — nothing was sent.", "err");
      return;
    }

    submitBtn.disabled = true;
    say("Sending…");

    var data = payload();

    /* text/plain keeps this a CORS "simple request", so Apps Script needs no preflight. */
    fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(data),
      redirect: "follow"
    })
      .then(function (res) { return res.json().catch(function () { return { ok: res.ok }; }); })
      .then(function (out) {
        if (!out || out.ok !== true) throw new Error((out && out.error) || "Unexpected response");
        document.getElementById("done-email").textContent = data.email;
        form.hidden = true;
        doneEl.hidden = false;
        doneEl.scrollIntoView({ behavior: "smooth", block: "center" });
      })
      .catch(function (err) {
        submitBtn.disabled = false;
        say("Couldn't send that — please try again, or email londoncafe@corgi.com. (" + err.message + ")", "err");
      });
  });

  document.getElementById("again").addEventListener("click", function () {
    form.reset();
    updateCount();
    Object.keys(RULES).concat(["consent"]).forEach(function (n) { setError(n, ""); });
    say("");
    submitBtn.disabled = false;
    doneEl.hidden = true;
    form.hidden = false;
    form.scrollIntoView({ behavior: "smooth", block: "start" });
    form.elements.full_name.focus();
  });
})();
