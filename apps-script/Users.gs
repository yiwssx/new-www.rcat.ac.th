function getUsers() {
  return getUsersWithPasswordHashes().map(sanitizeUserRecord);
}

function getUsersWithPasswordHashes() {
  const spreadsheet = getSpreadsheet();
  const sheet = spreadsheet.getSheetByName(SHEETS.users);
  let users = readObjects(sheet, USER_HEADERS);

  if (!users.length && hasBootstrapAdminCredentials()) {
    upsertRow(sheet, USER_HEADERS, buildDefaultAdminUser());
    users = readObjects(sheet, USER_HEADERS);
  }

  return users.map((user) => ({
    ...user,
    email: String(user.email || "").trim().toLowerCase(),
    role: user.role || "viewer",
    status: user.status || "active"
  }));
}

function sanitizeUserRecord(user) {
  return {
    id: user.id,
    name: user.name,
    email: String(user.email || "").trim().toLowerCase(),
    role: user.role,
    status: user.status,
    avatarUrl: user.avatarUrl || "",
    createdAt: user.createdAt || "",
    updatedAt: user.updatedAt || ""
  };
}

function ensureDefaultUsersSheet(spreadsheet) {
  const sheet = spreadsheet.getSheetByName(SHEETS.users);

  if (!sheet || sheet.getLastRow() > 1 || !hasBootstrapAdminCredentials()) {
    return;
  }

  const admin = buildDefaultAdminUser();
  upsertRow(sheet, USER_HEADERS, admin);
}

function buildDefaultAdminUser() {
  const email = String(getSetting(SETTING_KEYS.defaultAdminEmail) || "").trim().toLowerCase();
  const passwordHash = String(getSetting(SETTING_KEYS.defaultAdminPasswordHash) || "").trim();

  if (!email || !passwordHash) {
    throw new Error(
      "Default admin is not configured. Set Script Properties defaultAdminEmail and defaultAdminPasswordHash."
    );
  }

  const now = new Date().toISOString();
  return {
    id: "user-admin",
    name: String(getSetting(SETTING_KEYS.defaultAdminName) || "Administrator").trim() || "Administrator",
    email,
    role: "admin",
    status: "active",
    passwordHash,
    avatarUrl: "",
    createdAt: now,
    updatedAt: now
  };
}

function hasBootstrapAdminCredentials() {
  const email = String(getSetting(SETTING_KEYS.defaultAdminEmail) || "").trim();
  const passwordHash = String(getSetting(SETTING_KEYS.defaultAdminPasswordHash) || "").trim();

  return Boolean(email && passwordHash);
}

function loginUser(input) {
  validateRequired(input, ["email", "password"]);

  const email = String(input.email || "").trim().toLowerCase();
  const password = String(input.password || "");
  assertLoginAttemptsAllowed(email);
  const user = getUsersWithPasswordHashes().find((item) => item.email === email);

  if (!user || user.status !== "active") {
    registerFailedLoginAttempt(email);
    throw createHttpError("Invalid email or password.", 401);
  }

  let passwordMatches = false;
  try {
    passwordMatches = verifyPasswordHash(password, user.passwordHash);
  } catch (error) {
    registerFailedLoginAttempt(email);
    throw error;
  }

  if (!passwordMatches) {
    registerFailedLoginAttempt(email);
    throw createHttpError("Invalid email or password.", 401);
  }

  clearFailedLoginAttempts(email);
  return buildAuthSession(user);
}

function buildAuthSession(user) {
  const configuredHours = Number(getSetting(SETTING_KEYS.authSessionHours) || AUTH_SESSION_HOURS_FALLBACK);
  const sessionHours = configuredHours > 0 ? configuredHours : AUTH_SESSION_HOURS_FALLBACK;
  const expiresAt = new Date(Date.now() + sessionHours * 60 * 60 * 1000);

  return {
    user: sanitizeUserRecord(user),
    token: createAuthToken(user, expiresAt),
    expiresAt: expiresAt.toISOString()
  };
}

function loginRateLimitCacheKey(email) {
  return `cms:login-fail:${String(email || "").trim().toLowerCase()}`;
}

function assertLoginAttemptsAllowed(email) {
  const cacheKey = loginRateLimitCacheKey(email);
  const attemptsRaw = CacheService.getScriptCache().get(cacheKey);
  const attempts = Number(attemptsRaw || "0");

  if (attempts >= LOGIN_RATE_LIMIT_MAX_ATTEMPTS) {
    throw createHttpError("Too many login attempts. Please wait and try again.", 429);
  }
}

function registerFailedLoginAttempt(email) {
  const cache = CacheService.getScriptCache();
  const cacheKey = loginRateLimitCacheKey(email);
  const attemptsRaw = cache.get(cacheKey);
  const attempts = Number(attemptsRaw || "0") + 1;
  cache.put(cacheKey, String(attempts), LOGIN_RATE_LIMIT_WINDOW_SECONDS);
}

function clearFailedLoginAttempts(email) {
  const cacheKey = loginRateLimitCacheKey(email);
  CacheService.getScriptCache().remove(cacheKey);
}

function createAuthToken(user, expiresAt) {
  const header = base64UrlEncodeJson({
    alg: "HS256",
    typ: "JWT"
  });
  const payload = base64UrlEncodeJson({
    sub: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    exp: Math.floor(expiresAt.getTime() / 1000)
  });
  const unsignedToken = `${header}.${payload}`;
  const signature = signAuthToken(unsignedToken);

  return `${unsignedToken}.${signature}`;
}

function verifyAuthToken(token) {
  const parts = String(token || "").split(".");

  if (parts.length !== 3 || !parts[0] || !parts[1] || !parts[2]) {
    throw createHttpError("Invalid session token.", 401);
  }

  const unsignedToken = `${parts[0]}.${parts[1]}`;
  const expectedSignature = signAuthToken(unsignedToken);

  if (!constantTimeEquals(parts[2], expectedSignature)) {
    throw createHttpError("Invalid session token.", 401);
  }

  const claims = parseBase64UrlJson(parts[1]);
  if (!claims || !claims.sub || !claims.email || !claims.exp) {
    throw createHttpError("Invalid session token.", 401);
  }

  if (Number(claims.exp) * 1000 <= Date.now()) {
    throw createHttpError("Session expired. Please sign in again.", 401);
  }

  const normalizedEmail = String(claims.email || "").trim().toLowerCase();
  const user = getUsersWithPasswordHashes().find((item) => item.id === claims.sub && item.email === normalizedEmail);

  if (!user || user.status !== "active") {
    throw createHttpError("Session user is no longer active.", 401);
  }

  return {
    user: sanitizeUserRecord(user),
    claims
  };
}

function signAuthToken(unsignedToken) {
  const signature = Utilities.computeHmacSha256Signature(
    unsignedToken,
    ensureAuthTokenSecret(),
    Utilities.Charset.UTF_8
  );

  return base64UrlEncodeBytes(signature);
}

function base64UrlEncodeJson(value) {
  const json = JSON.stringify(value);
  return Utilities.base64EncodeWebSafe(json, Utilities.Charset.UTF_8).replace(/=+$/g, "");
}

function base64UrlEncodeBytes(value) {
  return Utilities.base64EncodeWebSafe(value).replace(/=+$/g, "");
}

function parseBase64UrlJson(value) {
  const padding = "=".repeat((4 - (value.length % 4)) % 4);
  const json = Utilities.newBlob(Utilities.base64DecodeWebSafe(value + padding)).getDataAsString();

  try {
    return JSON.parse(json);
  } catch (error) {
    throw createHttpError("Invalid session token.", 401);
  }
}

function constantTimeEquals(left, right) {
  const leftValue = String(left || "");
  const rightValue = String(right || "");

  if (leftValue.length !== rightValue.length) {
    return false;
  }

  let diff = 0;
  for (let index = 0; index < leftValue.length; index += 1) {
    diff |= leftValue.charCodeAt(index) ^ rightValue.charCodeAt(index);
  }

  return diff === 0;
}

function createPasswordHash(password) {
  const salt = Utilities.getUuid().replace(/-/g, "");
  const digest = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    `${salt}:${String(password || "")}`,
    Utilities.Charset.UTF_8
  );

  return `sha256$${salt}$${base64UrlEncodeBytes(digest)}`;
}

function verifyPasswordHash(password, storedHash) {
  const normalizedHash = String(storedHash || "").trim();

  if (!normalizedHash) {
    return false;
  }

  if (normalizedHash.indexOf("sha256$") === 0) {
    const segments = normalizedHash.split("$");

    if (segments.length !== 3) {
      return false;
    }

    const salt = segments[1];
    const expectedDigest = segments[2];
    const computedDigest = Utilities.computeDigest(
      Utilities.DigestAlgorithm.SHA_256,
      `${salt}:${String(password || "")}`,
      Utilities.Charset.UTF_8
    );

    return constantTimeEquals(base64UrlEncodeBytes(computedDigest), expectedDigest);
  }

  if (normalizedHash.indexOf("$2") === 0) {
    throw createHttpError(
      "This account uses a legacy password hash. Reset the password from the CMS user manager.",
      401
    );
  }

  return false;
}

function upsertUser(user) {
  validateRequired(user, ["name", "email", "role", "status"]);

  const spreadsheet = getSpreadsheet();
  const sheet = spreadsheet.getSheetByName(SHEETS.users);
  const users = getUsersWithPasswordHashes();
  const id = user.id || `user-${Date.now()}`;
  const normalizedEmail = String(user.email || "").trim().toLowerCase();
  const duplicateUser = users.find((item) => item.email === normalizedEmail && item.id !== id);

  if (duplicateUser) {
    throw new Error("A user with this email already exists.");
  }

  const existingUser = users.find((item) => item.id === id);
  const plainPassword = String(user.password || "").trim();
  const explicitPasswordHash = String(user.passwordHash || "").trim();
  let passwordHash = existingUser ? String(existingUser.passwordHash || "") : "";

  if (plainPassword) {
    passwordHash = createPasswordHash(plainPassword);
  } else if (explicitPasswordHash) {
    if (explicitPasswordHash.indexOf("sha256$") !== 0) {
      throw new Error("Only sha256 password hashes are accepted. Use password instead.");
    }

    passwordHash = explicitPasswordHash;
  }

  if (!passwordHash) {
    throw new Error("Password is required for new users.");
  }

  const nextUser = {
    id,
    name: user.name,
    email: normalizedEmail,
    role: user.role,
    status: user.status,
    passwordHash,
    avatarUrl: user.avatarUrl || (existingUser ? existingUser.avatarUrl : ""),
    createdAt: existingUser ? existingUser.createdAt : new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  upsertRow(sheet, USER_HEADERS, nextUser);
  return sanitizeUserRecord(nextUser);
}

function deleteUser(id) {
  if (!id) {
    throw new Error("Missing user id.");
  }

  const users = getUsersWithPasswordHashes();
  const target = users.find((user) => user.id === id);

  if (!target) {
    return {
      id,
      deleted: false
    };
  }

  const activeAdmins = users.filter((user) => user.role === "admin" && user.status === "active");

  if (target.role === "admin" && target.status === "active" && activeAdmins.length <= 1) {
    throw new Error("At least one active administrator is required.");
  }

  deleteRowById(SHEETS.users, USER_HEADERS, id);
  return {
    id,
    deleted: true
  };
}

function resetUsers() {
  if (!hasBootstrapAdminCredentials()) {
    throw new Error(
      "Cannot reset users because default admin credentials are not configured in Script Properties."
    );
  }

  const spreadsheet = getSpreadsheet();
  const sheet = spreadsheet.getSheetByName(SHEETS.users);
  const admin = buildDefaultAdminUser();

  sheet.clear();
  sheet.getRange(1, 1, 1, USER_HEADERS.length).setValues([USER_HEADERS]);
  sheet.setFrozenRows(1);
  sheet.getRange(2, 1, 1, USER_HEADERS.length).setValues([
    USER_HEADERS.map((header) => admin[header] || "")
  ]);

  return getUsers();
}
