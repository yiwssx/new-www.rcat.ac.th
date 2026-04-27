import { getGoogleAppsScriptUrl, projectSettings } from "../config/projectSettings";
import { User, UserAccount } from "../types";
import {
  deleteUserAccountFromApi,
  getUserAccountsFromApi,
  resetUserAccountsFromApi,
  saveUserAccountToApi
} from "./googleApi";

export interface UserAccountInput {
  id?: string;
  name: string;
  email: string;
  role: User["role"];
  status: UserAccount["status"];
  password?: string;
}

const bootstrapUsers = projectSettings.auth.bootstrapUsers;
let userCache: UserAccount[] | null = null;

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function usingBackendUsers() {
  return Boolean(getGoogleAppsScriptUrl());
}

function getBootstrapUsers() {
  return bootstrapUsers.map((user) => ({
    ...user,
    email: normalizeEmail(user.email)
  }));
}

function assertCanManageUsers(actor?: User | null) {
  if (actor?.role !== "admin") {
    throw new Error("Only administrators can manage users.");
  }
}

async function hashPassword(password: string) {
  const bcrypt = await import("bcryptjs");
  return bcrypt.hash(password, 8);
}

function ensureAtLeastOneActiveAdmin(users: UserAccount[]) {
  const activeAdmins = users.filter((user) => user.role === "admin" && user.status === "active");

  if (!activeAdmins.length) {
    throw new Error("At least one active administrator is required.");
  }
}

export async function getUserAccounts(): Promise<UserAccount[]> {
  if (!usingBackendUsers()) {
    const users = userCache ?? getBootstrapUsers();
    userCache = users;
    return users;
  }

  const users = await getUserAccountsFromApi();
  userCache = users.map((user) => ({
    ...user,
    email: normalizeEmail(user.email)
  }));
  return userCache;
}

export async function authenticateUser(email: string, password: string): Promise<UserAccount> {
  const users = await getUserAccounts();
  const user = users.find((account) => account.email === normalizeEmail(email));

  if (!user || user.status !== "active") {
    throw new Error("Invalid email or password.");
  }

  if (!user.passwordHash) {
    throw new Error("Local authentication is unavailable for this account.");
  }

  const bcrypt = await import("bcryptjs");
  const passwordMatches = await bcrypt.compare(password, user.passwordHash);

  if (!passwordMatches) {
    throw new Error("Invalid email or password.");
  }

  return user;
}

export async function saveUserAccount(input: UserAccountInput, actor?: User | null): Promise<UserAccount> {
  assertCanManageUsers(actor);

  const email = normalizeEmail(input.email);
  const users = await getUserAccounts();
  const existingUser = input.id ? users.find((user) => user.id === input.id) : undefined;
  const duplicateUser = users.find((user) => user.email === email && user.id !== input.id);

  if (duplicateUser) {
    throw new Error("A user with this email already exists.");
  }

  if (!existingUser && !input.password) {
    throw new Error("Password is required for a new user.");
  }

  if (!usingBackendUsers()) {
    const passwordHash = input.password
      ? await hashPassword(input.password)
      : existingUser?.passwordHash;

    if (!passwordHash) {
      throw new Error("Password is required.");
    }

    const now = new Date().toISOString();
    const nextUser: UserAccount = {
      id: existingUser?.id ?? `user-${crypto.randomUUID()}`,
      name: input.name.trim(),
      email,
      role: input.role,
      status: input.status,
      passwordHash,
      createdAt: existingUser?.createdAt ?? now,
      updatedAt: now
    };

    const nextUsers = existingUser
      ? users.map((user) => (user.id === nextUser.id ? nextUser : user))
      : [nextUser, ...users];

    ensureAtLeastOneActiveAdmin(nextUsers);
    userCache = nextUsers;
    return nextUser;
  }

  const nextUser = await saveUserAccountToApi({
    id: input.id,
    name: input.name.trim(),
    email,
    role: input.role,
    status: input.status,
    password: input.password,
    avatarUrl: existingUser?.avatarUrl
  });

  await getUserAccounts();
  return nextUser;
}

export async function deleteUserAccount(id: string, actor?: User | null): Promise<UserAccount[]> {
  assertCanManageUsers(actor);

  const users = await getUserAccounts();
  const targetUser = users.find((user) => user.id === id);

  if (!targetUser) {
    return users;
  }

  if (targetUser.role === "admin" && targetUser.status === "active") {
    const activeAdmins = users.filter((user) => user.role === "admin" && user.status === "active");
    if (activeAdmins.length <= 1) {
      throw new Error("At least one active administrator is required.");
    }
  }

  if (!usingBackendUsers()) {
    userCache = users.filter((user) => user.id !== id);
    return userCache;
  }

  await deleteUserAccountFromApi(id);
  return getUserAccounts();
}

export async function resetUserAccounts(actor?: User | null): Promise<UserAccount[]> {
  assertCanManageUsers(actor);

  if (!usingBackendUsers()) {
    userCache = getBootstrapUsers();
    return userCache;
  }

  const users = await resetUserAccountsFromApi();
  userCache = users;
  return users;
}
