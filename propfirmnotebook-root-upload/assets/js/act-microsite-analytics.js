(function () {
  var endpoint = "https://www.agenticaistaffing.com/api/analytics/public";
  var sessionKey = "act-microsite-session";

  function sessionId() {
    try {
      var existing = sessionStorage.getItem(sessionKey);
      if (existing) return existing;
      var value = "act_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 10);
      sessionStorage.setItem(sessionKey, value);
      return value;
    } catch (error) {
      return "act_" + Date.now().toString(36);
    }
  }

  function track(eventType, details) {
    var body = JSON.stringify({
      event_type: eventType,
      path: location.pathname || "/",
      session_id: sessionId(),
      payload_summary: Object.assign({
        source: "investing_for_beginners_microsite",
        label: document.title || "Investing for Beginners",
      }, details || {}),
    });
    fetch(endpoint, {
      method: "POST",
      mode: "cors",
      headers: { "Content-Type": "application/json" },
      body: body,
      keepalive: true,
    }).catch(function () {});
  }

  track("page_view");
})();
