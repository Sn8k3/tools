const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

const GOOGLE_CLIENT_ID = "186020384677-4d1427paen3grdsi5ks2kul4hqar9ijl.apps.googleusercontent.com";
const REDIRECT_URI = "https://tiny-hat-80bd.charlieweis6.workers.dev/auth/google/callback";
const SCOPES = [
  "https://www.googleapis.com/auth/classroom.courses.readonly",
  "https://www.googleapis.com/auth/classroom.announcements.readonly",
  "https://www.googleapis.com/auth/classroom.courseworkmaterials.readonly",
  "https://www.googleapis.com/auth/classroom.student-submissions.me.readonly",
  "email",
  "profile",
].join(" ");

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...CORS },
  });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: CORS });
    }

    // ── Start Google OAuth ──
    if (path === "/auth/google/start") {
      const userId = url.searchParams.get("user_id");
      if (!userId) return json({ error: "Missing user_id" }, 400);
      const state = btoa(JSON.stringify({ userId, ts: Date.now() }));
      const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
      authUrl.searchParams.set("client_id", GOOGLE_CLIENT_ID);
      authUrl.searchParams.set("redirect_uri", REDIRECT_URI);
      authUrl.searchParams.set("response_type", "code");
      authUrl.searchParams.set("scope", SCOPES);
      authUrl.searchParams.set("access_type", "offline");
      authUrl.searchParams.set("prompt", "consent");
      authUrl.searchParams.set("state", state);
      return Response.redirect(authUrl.toString(), 302);
    }

    // ── Google OAuth Callback ──
    if (path === "/auth/google/callback") {
      const code = url.searchParams.get("code");
      const state = url.searchParams.get("state");
      const error = url.searchParams.get("error");

      if (error) return Response.redirect(`https://sn8k3.github.io/tools/dashboard.html?classroom_error=${encodeURIComponent(error)}`, 302);
      if (!code || !state) return Response.redirect("https://sn8k3.github.io/tools/dashboard.html?classroom_error=missing_params", 302);

      let userId;
      try { userId = JSON.parse(atob(state)).userId; } catch {
        return Response.redirect("https://sn8k3.github.io/tools/dashboard.html?classroom_error=bad_state", 302);
      }

      const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          code,
          client_id: GOOGLE_CLIENT_ID,
          client_secret: env.GOOGLE_CLIENT_SECRET,
          redirect_uri: REDIRECT_URI,
          grant_type: "authorization_code",
        }),
      });

      const tokens = await tokenRes.json();
      if (!tokens.access_token) return Response.redirect("https://sn8k3.github.io/tools/dashboard.html?classroom_error=token_failed", 302);

      // Check env vars are set
      if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_KEY) {
        return Response.redirect("https://sn8k3.github.io/tools/dashboard.html?classroom_error=worker_not_configured", 302);
      }

      await saveTokens(env, userId, tokens);
      return Response.redirect("https://sn8k3.github.io/tools/dashboard.html?classroom_connected=1", 302);
    }

    // ── Get Classroom feed ──
    if (path === "/classroom/feed" && request.method === "POST") {
      const body = await request.json();
      const { user_id } = body;
      if (!user_id) return json({ error: "Missing user_id" }, 400);

      let tokens = await loadTokens(env, user_id);
      if (!tokens) return json({ error: "not_connected" }, 401);

      if (Date.now() > tokens.expiry_ms - 60000) {
        tokens = await refreshTokens(env, user_id, tokens.refresh_token);
        if (!tokens) return json({ error: "token_refresh_failed" }, 401);
      }

      const access = tokens.access_token;
      const coursesRes = await fetch(
        "https://classroom.googleapis.com/v1/courses?courseStates=ACTIVE&pageSize=20",
        { headers: { Authorization: `Bearer ${access}` } }
      );
      const { courses = [] } = await coursesRes.json();

      const feedItems = [];
      await Promise.all(courses.slice(0, 10).map(async (course) => {
        try {
          const [annRes, cwRes] = await Promise.all([
            fetch(`https://classroom.googleapis.com/v1/courses/${course.id}/announcements?pageSize=5&orderBy=updateTime desc`, { headers: { Authorization: `Bearer ${access}` } }),
            fetch(`https://classroom.googleapis.com/v1/courses/${course.id}/courseWork?pageSize=5&orderBy=updateTime desc`, { headers: { Authorization: `Bearer ${access}` } }),
          ]);
          const { announcements = [] } = await annRes.json();
          const { courseWork = [] } = await cwRes.json();

          announcements.forEach(ann => feedItems.push({
            type: "announcement",
            courseId: course.id, courseName: course.name, courseSection: course.section || "",
            id: ann.id, text: ann.text || "", creationTime: ann.creationTime,
            updateTime: ann.updateTime, materials: ann.materials || [], alternateLink: ann.alternateLink || "",
          }));

          courseWork.forEach(cw => feedItems.push({
            type: "coursework",
            courseId: course.id, courseName: course.name, courseSection: course.section || "",
            id: cw.id, title: cw.title || "", description: cw.description || "",
            dueDate: cw.dueDate || null, dueTime: cw.dueTime || null,
            creationTime: cw.creationTime, updateTime: cw.updateTime,
            workType: cw.workType || "ASSIGNMENT", alternateLink: cw.alternateLink || "",
            maxPoints: cw.maxPoints || null,
          }));
        } catch {}
      }));

      feedItems.sort((a, b) => new Date(b.updateTime) - new Date(a.updateTime));
      return json({ courses: courses.map(c => ({ id: c.id, name: c.name, section: c.section || "" })), feed: feedItems.slice(0, 30) });
    }

    // ── Disconnect Classroom ──
    if (path === "/classroom/disconnect" && request.method === "POST") {
      const { user_id } = await request.json();
      if (!user_id) return json({ error: "Missing user_id" }, 400);
      await deleteTokens(env, user_id);
      return json({ ok: true });
    }

    // ── Anthropic proxy (existing — default route) ──
    if (request.method === "POST") {
      try {
        const body = await request.json();
        const payload = {
          model: body.model || "claude-sonnet-4-20250514",
          max_tokens: Math.min(body.max_tokens || 2000, 2000),
          messages: body.messages,
        };
        if (body.system) payload.system = body.system;
        const response = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": env.ANTHROPIC_API_KEY,
            "anthropic-version": "2023-06-01",
          },
          body: JSON.stringify(payload),
        });
        const data = await response.json();
        return new Response(JSON.stringify(data), {
          status: response.status,
          headers: { "Content-Type": "application/json", ...CORS },
        });
      } catch (err) {
        return json({ error: { message: "Proxy error: " + err.message } }, 500);
      }
    }

    return json({ error: "Not found" }, 404);
  },
};

// ── Supabase helpers ──
async function supabaseReq(env, method, path, body) {
  const res = await fetch(`${env.SUPABASE_URL}/rest/v1${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      "apikey": env.SUPABASE_SERVICE_KEY,
      "Authorization": `Bearer ${env.SUPABASE_SERVICE_KEY}`,
      "Prefer": method === "POST" ? "resolution=merge-duplicates" : "",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) return null;
  const text = await res.text();
  try { return text ? JSON.parse(text) : {}; } catch { return {}; }
}

async function saveTokens(env, userId, tokens) {
  await supabaseReq(env, "POST", "/google_tokens", {
    user_id: userId,
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token || null,
    expiry_ms: Date.now() + (tokens.expires_in || 3600) * 1000,
    updated_at: new Date().toISOString(),
  });
}

async function loadTokens(env, userId) {
  const result = await supabaseReq(env, "GET", `/google_tokens?user_id=eq.${userId}&select=access_token,refresh_token,expiry_ms`, null);
  return result?.length ? result[0] : null;
}

async function deleteTokens(env, userId) {
  await supabaseReq(env, "DELETE", `/google_tokens?user_id=eq.${userId}`, null);
}

async function refreshTokens(env, userId, refreshToken) {
  if (!refreshToken) return null;
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: GOOGLE_CLIENT_ID,
      client_secret: env.GOOGLE_CLIENT_SECRET,
      grant_type: "refresh_token",
    }),
  });
  const tokens = await res.json();
  if (!tokens.access_token) return null;
  tokens.refresh_token = tokens.refresh_token || refreshToken;
  await saveTokens(env, userId, tokens);
  return { access_token: tokens.access_token, refresh_token: tokens.refresh_token, expiry_ms: Date.now() + (tokens.expires_in || 3600) * 1000 };
}
