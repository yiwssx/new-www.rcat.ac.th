const CMS_SCRIPT_LOCK_TIMEOUT_MS = 5000;

function withScriptLock(callback) {
  const lock = LockService.getScriptLock();
  let lockAcquired = false;

  try {
    lockAcquired = lock.tryLock(CMS_SCRIPT_LOCK_TIMEOUT_MS);

    if (!lockAcquired) {
      throw createHttpError("CMS is busy. Please retry.", 503);
    }

    return callback();
  } finally {
    if (lockAcquired) {
      lock.releaseLock();
    }
  }
}
