// Create a URL object with just the "v" and optional "list" search parameters
function createBaseUrl(url) {
  const urlObj = new URL(url);
  const newUrlObj = new URL(`${urlObj.origin}/watch`);

  newUrlObj.searchParams.set("v", urlObj.searchParams.get("v"));
  if (urlObj.searchParams.get("list")) {
    newUrlObj.searchParams.set("list", urlObj.searchParams.get("list"));
  }

  return newUrlObj.toString();
}

function createTimestampedUrl(url, timestamp) {
  const baseUrl = createBaseUrl(url);
  const urlObj = new URL(baseUrl);

  urlObj.searchParams.set("t", `${timestamp}s`);
  return urlObj.toString();
}

function doesBookmarksMatch(bookmarkUrlObj, nodeUrlObj) {
  const doesVideoIdMatch =
    bookmarkUrlObj.searchParams.get("v") === nodeUrlObj.searchParams.get("v");

  const doesListIdMatch =
    bookmarkUrlObj.searchParams.get("list") ===
    nodeUrlObj.searchParams.get("list");

  return (
    bookmarkUrlObj.origin === nodeUrlObj.origin &&
    doesVideoIdMatch &&
    doesListIdMatch
  );
}

async function doesSameTimestampExists(folderId, bookmarkUrlObj) {
  const folderChildren = await chrome.bookmarks.getChildren(folderId);

  return folderChildren.some((node) => {
    if (!node.url) return false;
    const nodeUrlObj = new URL(node.url);

    if (!doesBookmarksMatch(bookmarkUrlObj, nodeUrlObj)) return false;
    return (
      nodeUrlObj.searchParams.get("t") === bookmarkUrlObj.searchParams.get("t")
    );
  });
}

// If a bookmark of the same video exists with a different timestamp, update it
// If there are more than one bookmark of the same video, remove the nodes with the higher indices
async function updateIfDifferentTimestampsExist(
  folderId,
  bookmarkUrlObj,
  bookmarkTitle,
) {
  const folderChildren = await chrome.bookmarks.getChildren(folderId);

  const matchingNodes = folderChildren.filter((node) => {
    if (!node.url) return false;
    const nodeUrlObj = new URL(node.url);
    return doesBookmarksMatch(bookmarkUrlObj, nodeUrlObj);
  });

  if (matchingNodes.length >= 1) {
    await Promise.all([
      chrome.bookmarks.update(matchingNodes[0].id, {
        url: bookmarkUrlObj.toString(),
        title: bookmarkTitle,
      }),
      ...matchingNodes.slice(1).map((node) => chrome.bookmarks.remove(node.id)),
    ]);

    return true;
  }

  return false;
}

export {
  createBaseUrl,
  createTimestampedUrl,
  doesBookmarksMatch,
  doesSameTimestampExists,
  updateIfDifferentTimestampsExist,
};
