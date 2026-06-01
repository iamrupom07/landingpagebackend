import { getRedis } from "../../config/redis";

const ADMIN_TOKEN_VERSION_CACHE_TTL_SECONDS = 60;

export function adminTokenVersionCacheKey(adminId: string): string {
  return `auth:admin:${adminId}:token-version`;
}

export async function getCachedAdminTokenVersion(
  adminId: string,
): Promise<number | null> {
  const redis = getRedis();
  if (!redis) return null;

  const key = adminTokenVersionCacheKey(adminId);
  try {
    const value = await redis.get(key);
    if (!value) return null;

    const tokenVersion = Number(value);
    if (!Number.isInteger(tokenVersion) || tokenVersion < 0) {
      await redis.del(key).catch(() => undefined);
      return null;
    }

    return tokenVersion;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("Failed to read admin token cache:", message);
    return null;
  }
}

export async function setCachedAdminTokenVersion(
  adminId: string,
  tokenVersion: number,
): Promise<void> {
  const redis = getRedis();
  if (!redis) return;

  try {
    await redis.set(
      adminTokenVersionCacheKey(adminId),
      String(tokenVersion),
      "EX",
      ADMIN_TOKEN_VERSION_CACHE_TTL_SECONDS,
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("Failed to write admin token cache:", message);
  }
}

export async function deleteCachedAdminTokenVersion(
  adminId: string,
): Promise<void> {
  const redis = getRedis();
  if (!redis) return;

  try {
    await redis.del(adminTokenVersionCacheKey(adminId));
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("Failed to delete admin token cache:", message);
  }
}
