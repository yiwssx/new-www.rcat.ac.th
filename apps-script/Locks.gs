const MEDIA_BRIDGE_LOCK_TIMEOUT_MS = 5000;

function withScriptLock(callback) {
  const lock = LockService.getScriptLock();
  let lockAcquired = false;

  try {
    lockAcquired = lock.tryLock(MEDIA_BRIDGE_LOCK_TIMEOUT_MS);

    if (!lockAcquired) {
      throw createHttpError("Media bridge is busy. Please retry.", 503);
    }

    return callback();
  } finally {
    if (lockAcquired) {
      lock.releaseLock();
    }
  }
}
