import { hashPassword } from "@shortfactory/auth";
import { createDb } from "../src/client";
import { createIdentityRepository } from "../src/repositories/identity";

const email = process.env.SHORTFACTORY_ADMIN_EMAIL?.trim().toLowerCase() || "admin@example.com";
const password = process.env.SHORTFACTORY_ADMIN_PASSWORD;
const workspaceName = process.env.SHORTFACTORY_WORKSPACE_NAME?.trim() || "Short Factory";

if (!password || password.length < 12) {
  throw new Error("SHORTFACTORY_ADMIN_PASSWORDに12文字以上の初期パスワードを指定してください");
}

const { db, pool } = createDb();
const identity = createIdentityRepository(db);

try {
  const existingUser = await identity.findUserByEmail(email);
  let userId: string;
  let userEmail: string;
  if (!existingUser) {
    const createdUser = await identity.createUser({ email, passwordHash: await hashPassword(password) });
    userId = createdUser.id;
    userEmail = createdUser.email;
    console.log(`created user: ${userEmail}`);
  } else {
    userId = existingUser.id;
    userEmail = existingUser.email;
    console.log(`user already exists: ${userEmail}`);
  }

  const workspaces = await identity.listWorkspaces(userId);
  if (workspaces.length === 0) {
    const workspace = await identity.createWorkspace({ ownerUserId: userId, name: workspaceName });
    console.log(`created workspace: ${workspace.name} (${workspace.id})`);
  } else {
    console.log(`workspace already exists: ${workspaces[0]!.name} (${workspaces[0]!.id})`);
  }
  console.log("seed complete");
} finally {
  await pool.end();
}
