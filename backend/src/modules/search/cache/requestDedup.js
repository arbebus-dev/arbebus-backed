/**
 * Request Deduplication Layer
 * Prevents duplicate API calls for identical concurrent requests
 *
 * Example: if 5 users search for "Vilnius" at same time,
 * only 1 API call is made, and all 5 get the same results
 */

const pendingRequests = new Map();

async function deduplicateRequest(key, fn) {
  // Check if this request is already pending
  if (pendingRequests.has(key)) {
    return await pendingRequests.get(key);
  }

  // Create a promise for this request
  const promise = fn()
    .then((result) => {
      pendingRequests.delete(key);
      return result;
    })
    .catch((error) => {
      pendingRequests.delete(key);
      throw error;
    });

  // Store the promise so other concurrent requests can use it
  pendingRequests.set(key, promise);

  return await promise;
}

function dedupStats() {
  return {
    pendingRequests: pendingRequests.size,
  };
}

module.exports = { deduplicateRequest, dedupStats };
