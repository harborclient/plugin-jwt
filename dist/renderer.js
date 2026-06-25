// node_modules/.pnpm/@harborclient+sdk@0.4.3_react@19.2.7/node_modules/@harborclient/sdk/dist/runtime/reactHost.js
var hostReact = null;
function setHostReact(react) {
  hostReact = react;
}
function requireHostReact() {
  if (hostReact == null) {
    throw new Error(
      "Plugin React host is not installed. Call installReact(hc.react) at the start of activate()."
    );
  }
  return hostReact;
}

// node_modules/.pnpm/@harborclient+sdk@0.4.3_react@19.2.7/node_modules/@harborclient/sdk/dist/runtime/index.js
function installReact(react) {
  setHostReact(react);
}

// node_modules/.pnpm/@harborclient+sdk@0.4.3_react@19.2.7/node_modules/@harborclient/sdk/dist/runtime/react.js
function hook(name) {
  const react = requireHostReact();
  const fn = react[name];
  if (typeof fn !== "function") {
    throw new Error(`React hook "${String(name)}" is not available on hc.react.`);
  }
  return fn;
}
function useState(initialState) {
  return hook("useState")(initialState);
}
function useEffect(effect, deps) {
  return hook("useEffect")(effect, deps);
}
function useMemo(factory, deps) {
  return hook("useMemo")(factory, deps);
}

// src/jwt/decode.ts
var JWT_SEGMENT_PATTERN = /^[A-Za-z0-9_-]+$/;
var CLOCK_SKEW_MS = 6e4;
function isJwtDecodeError(result) {
  return "error" in result;
}
function base64UrlDecode(value) {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/");
  const padLength = (4 - padded.length % 4) % 4;
  const normalized = padded + "=".repeat(padLength);
  const binary = atob(normalized);
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}
function hasJwtStructure(token) {
  const trimmed = token.trim();
  const parts = trimmed.split(".");
  if (parts.length !== 3) {
    return false;
  }
  return parts.every(
    (part) => part.length > 0 && JWT_SEGMENT_PATTERN.test(part)
  );
}
function stripBearerPrefix(value) {
  return value.trim().replace(/^Bearer\s+/i, "").trim();
}
function claimToMs(claim) {
  if (typeof claim === "number" && Number.isFinite(claim)) {
    return claim * 1e3;
  }
  return null;
}
function collectWarnings(header, payload, nowMs) {
  const warnings = [];
  if (typeof header.alg !== "string" || header.alg.trim() === "") {
    warnings.push("No alg claim in header.");
  }
  const expMs = claimToMs(payload.exp);
  if (expMs != null && expMs <= nowMs) {
    warnings.push("Expired.");
  }
  const nbfMs = claimToMs(payload.nbf);
  if (nbfMs != null && nbfMs > nowMs) {
    warnings.push("Not yet valid.");
  }
  const iatMs = claimToMs(payload.iat);
  if (iatMs != null && iatMs > nowMs + CLOCK_SKEW_MS) {
    warnings.push("Issued in the future.");
  }
  return warnings;
}
function decodeJwt(token, nowMs = Date.now()) {
  const raw = stripBearerPrefix(token);
  if (!hasJwtStructure(raw)) {
    return { error: "Malformed JWT: expected three base64url segments." };
  }
  const [encodedHeader, encodedPayload] = raw.split(".");
  let header;
  let payload;
  try {
    const parsedHeader = JSON.parse(base64UrlDecode(encodedHeader));
    if (typeof parsedHeader !== "object" || parsedHeader == null || Array.isArray(parsedHeader)) {
      return { error: "Malformed JWT: header is not a JSON object." };
    }
    header = parsedHeader;
  } catch {
    return { error: "Malformed JWT: header could not be decoded." };
  }
  try {
    const parsedPayload = JSON.parse(
      base64UrlDecode(encodedPayload)
    );
    if (typeof parsedPayload !== "object" || parsedPayload == null || Array.isArray(parsedPayload)) {
      return { error: "Malformed JWT: payload is not a JSON object." };
    }
    payload = parsedPayload;
  } catch {
    return { error: "Malformed JWT: payload could not be decoded." };
  }
  return {
    header,
    payload,
    warnings: collectWarnings(header, payload, nowMs)
  };
}
function formatJwtTimeClaim(claim) {
  const ms = claimToMs(claim);
  if (ms == null) {
    return null;
  }
  return new Date(ms).toLocaleString();
}

// src/jwt/extract.ts
var JWT_REGEX = /(?:Bearer\s+)?(eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+)/g;
var KNOWN_JSON_KEYS = /* @__PURE__ */ new Set([
  "access_token",
  "id_token",
  "token",
  "jwt",
  "refresh_token"
]);
var HEADER_NAMES = [
  { name: "authorization", label: "Authorization" },
  { name: "www-authenticate", label: "WWW-Authenticate" },
  { name: "x-access-token", label: "X-Access-Token" },
  { name: "x-auth-token", label: "X-Auth-Token" },
  { name: "id-token", label: "Id-Token" }
];
var MAX_JSON_DEPTH = 10;
function isStructurallyValidJwt(token) {
  if (!hasJwtStructure(token)) {
    return false;
  }
  const result = decodeJwt(token);
  return !isJwtDecodeError(result);
}
function tryAddCandidate(candidates, raw, label, source) {
  const normalized = stripBearerPrefix(raw);
  if (!isStructurallyValidJwt(normalized)) {
    return;
  }
  candidates.push({
    id: `${source}:${label}:${normalized}`,
    raw: normalized,
    label,
    source
  });
}
function findHeaderValue(headers, name) {
  const row = headers.find(
    (header) => header.key.toLowerCase() === name.toLowerCase()
  );
  return row?.value;
}
function extractFromHeaders(headers) {
  const candidates = [];
  for (const { name, label } of HEADER_NAMES) {
    const value = findHeaderValue(headers, name);
    if (!value) {
      continue;
    }
    if (name === "www-authenticate") {
      const matches = value.matchAll(JWT_REGEX);
      for (const match of matches) {
        tryAddCandidate(candidates, match[1], label, "header");
      }
      continue;
    }
    tryAddCandidate(candidates, value, label, "header");
  }
  return candidates;
}
function extractWholeBody(body) {
  const candidates = [];
  const trimmed = body.trim();
  if (!trimmed) {
    return candidates;
  }
  tryAddCandidate(candidates, trimmed, "Body", "body");
  return candidates;
}
function walkJsonValue(value, path, depth, candidates) {
  if (depth > MAX_JSON_DEPTH) {
    return;
  }
  if (typeof value === "string") {
    const pathSegments = path.split(".");
    const fieldKey = pathSegments[pathSegments.length - 1] ?? path;
    const label = pathSegments.length === 2 && KNOWN_JSON_KEYS.has(fieldKey.toLowerCase()) ? `Body \xB7 ${fieldKey}` : `Body \xB7 ${path}`;
    tryAddCandidate(candidates, value, label, "body");
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) => {
      walkJsonValue(item, `${path}[${index}]`, depth + 1, candidates);
    });
    return;
  }
  if (typeof value === "object" && value != null) {
    for (const [key, nested] of Object.entries(value)) {
      const nextPath = path === "$" ? `$.${key}` : `${path}.${key}`;
      walkJsonValue(nested, nextPath, depth + 1, candidates);
    }
  }
}
function extractFromJsonBody(body) {
  const candidates = [];
  let parsed;
  try {
    parsed = JSON.parse(body);
  } catch {
    return candidates;
  }
  walkJsonValue(parsed, "$", 0, candidates);
  return candidates;
}
function extractByRegex(body) {
  const candidates = [];
  const seen = /* @__PURE__ */ new Set();
  for (const match of body.matchAll(JWT_REGEX)) {
    const token = match[1];
    if (seen.has(token)) {
      continue;
    }
    seen.add(token);
    tryAddCandidate(candidates, token, "Body \xB7 match", "body");
  }
  return candidates;
}
function extractFromBody(body) {
  const whole = extractWholeBody(body);
  if (whole.length > 0) {
    return whole;
  }
  const fromJson = extractFromJsonBody(body);
  if (fromJson.length > 0) {
    return fromJson;
  }
  return extractByRegex(body);
}
function dedupeCandidates(candidates) {
  const byRaw = /* @__PURE__ */ new Map();
  for (const candidate of candidates) {
    if (!byRaw.has(candidate.raw)) {
      byRaw.set(candidate.raw, candidate);
    }
  }
  return [...byRaw.values()];
}
function extractJwtCandidates(response) {
  if (!response) {
    return [];
  }
  const candidates = [
    ...extractFromHeaders(response.headers),
    ...extractFromBody(response.body)
  ];
  return dedupeCandidates(candidates);
}
function truncateJwt(token) {
  if (token.length <= 16) {
    return token;
  }
  return `${token.slice(0, 6)}\u2026${token.slice(-4)}`;
}

// node_modules/.pnpm/@harborclient+sdk@0.4.3_react@19.2.7/node_modules/@harborclient/sdk/dist/runtime/jsx-runtime.js
var Fragment = Symbol.for("@harborclient/sdk.Fragment");
function build(type, props, key) {
  const react = requireHostReact();
  const elementType = type === Fragment ? react.Fragment : type;
  const { children, ...rest } = props ?? {};
  if (key !== void 0) {
    rest.key = key;
  }
  return react.createElement(elementType, rest, children);
}
var jsx = build;
var jsxs = build;

// src/components/JwtCandidateList.tsx
function JwtCandidateList({ candidates, selectedId, onSelect }) {
  return /* @__PURE__ */ jsx(
    "div",
    {
      className: "flex w-[220px] shrink-0 flex-col gap-0.5 overflow-y-auto border-r border-separator bg-sidebar p-2",
      role: "listbox",
      "aria-label": "JWT tokens found in response",
      children: candidates.map((candidate) => {
        const selected = candidate.id === selectedId;
        return /* @__PURE__ */ jsxs(
          "button",
          {
            type: "button",
            role: "option",
            "aria-current": selected ? "true" : void 0,
            "aria-selected": selected,
            className: `rounded-md px-2 py-2 text-left text-[14px] ${selected ? "bg-selection text-text" : "text-text hover:bg-control"}`,
            onClick: () => onSelect(candidate.id),
            children: [
              /* @__PURE__ */ jsx("div", { className: "font-medium", children: candidate.label }),
              /* @__PURE__ */ jsx("div", { className: "mt-0.5 truncate font-mono text-muted", children: truncateJwt(candidate.raw) })
            ]
          },
          candidate.id
        );
      })
    }
  );
}

// src/components/JwtDetail.tsx
function JwtDetail({ token }) {
  const decoded = decodeJwt(token);
  if (isJwtDecodeError(decoded)) {
    return /* @__PURE__ */ jsx("div", { className: "flex flex-1 flex-col gap-2 p-3", children: /* @__PURE__ */ jsx("p", { className: "text-[14px] text-danger", children: decoded.error }) });
  }
  const timeClaims = [
    { key: "exp", label: "Expires" },
    { key: "nbf", label: "Not before" },
    { key: "iat", label: "Issued at" }
  ];
  return /* @__PURE__ */ jsxs("div", { className: "flex min-w-0 flex-1 flex-col gap-3 overflow-auto p-3", children: [
    decoded.warnings.length > 0 ? /* @__PURE__ */ jsx(
      "ul",
      {
        className: "m-0 list-disc space-y-1 pl-5 text-[14px] text-danger",
        "aria-label": "JWT warnings",
        children: decoded.warnings.map((warning) => /* @__PURE__ */ jsx("li", { children: warning }, warning))
      }
    ) : null,
    /* @__PURE__ */ jsxs("section", { "aria-labelledby": "jwt-time-claims-heading", children: [
      /* @__PURE__ */ jsx(
        "h3",
        {
          id: "jwt-time-claims-heading",
          className: "mb-1 text-[14px] font-medium text-text",
          children: "Time claims"
        }
      ),
      /* @__PURE__ */ jsx("dl", { className: "m-0 space-y-1 text-[14px]", children: timeClaims.map(({ key, label }) => {
        const formatted = formatJwtTimeClaim(decoded.payload[key]);
        return /* @__PURE__ */ jsxs("div", { className: "grid grid-cols-[7rem_1fr] gap-2", children: [
          /* @__PURE__ */ jsx("dt", { className: "text-muted", children: label }),
          /* @__PURE__ */ jsx("dd", { className: "m-0 text-text", children: formatted ?? "\u2014" })
        ] }, key);
      }) })
    ] }),
    /* @__PURE__ */ jsxs("section", { "aria-labelledby": "jwt-header-heading", children: [
      /* @__PURE__ */ jsx(
        "h3",
        {
          id: "jwt-header-heading",
          className: "mb-1 text-[14px] font-medium text-text",
          children: "Header"
        }
      ),
      /* @__PURE__ */ jsx("pre", { className: "m-0 overflow-auto rounded-md bg-control p-3 text-[14px] text-text", children: JSON.stringify(decoded.header, null, 2) })
    ] }),
    /* @__PURE__ */ jsxs("section", { "aria-labelledby": "jwt-payload-heading", children: [
      /* @__PURE__ */ jsx(
        "h3",
        {
          id: "jwt-payload-heading",
          className: "mb-1 text-[14px] font-medium text-text",
          children: "Payload"
        }
      ),
      /* @__PURE__ */ jsx("pre", { className: "m-0 overflow-auto rounded-md bg-control p-3 text-[14px] text-text", children: JSON.stringify(decoded.payload, null, 2) })
    ] })
  ] });
}

// src/JwtTab.tsx
function JwtTab({ context }) {
  const { response } = context;
  const candidates = useMemo(() => extractJwtCandidates(response), [response]);
  const [selectedId, setSelectedId] = useState(null);
  useEffect(() => {
    if (candidates.length === 0) {
      setSelectedId(null);
      return;
    }
    setSelectedId((current) => {
      if (current != null && candidates.some((candidate) => candidate.id === current)) {
        return current;
      }
      return candidates[0]?.id ?? null;
    });
  }, [candidates]);
  if (!response) {
    return /* @__PURE__ */ jsx("div", { className: "flex flex-1 items-center justify-center p-3 text-[14px] text-muted", children: "No response yet." });
  }
  if (candidates.length === 0) {
    return /* @__PURE__ */ jsx("div", { className: "flex flex-1 items-center justify-center p-3 text-[14px] text-muted", children: "No JWTs found in this response." });
  }
  const selected = candidates.find((candidate) => candidate.id === selectedId) ?? candidates[0];
  return /* @__PURE__ */ jsxs("div", { className: "flex min-h-0 flex-1 overflow-hidden", children: [
    /* @__PURE__ */ jsx(
      JwtCandidateList,
      {
        candidates,
        selectedId: selected.id,
        onSelect: setSelectedId
      }
    ),
    /* @__PURE__ */ jsx(JwtDetail, { token: selected.raw })
  ] });
}

// src/renderer.tsx
function activate(hc) {
  installReact(hc.react);
  hc.subscriptions.push(
    hc.ui.registerResponseTab({
      id: "jwt",
      title: "JWT",
      order: 50,
      when: "hasResponse",
      Component: ({ context }) => /* @__PURE__ */ jsx(JwtTab, { context })
    })
  );
}
export {
  activate
};
