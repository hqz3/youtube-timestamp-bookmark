chrome.action.onClicked.addListener(async (tab) => {
  function createTimestampedBookmarkUrl(url, timestamp) {
    const urlObj = new URL(url);

    // Delete the "index" search parameter if it exists
    if (urlObj.searchParams.get("index")) {
      urlObj.searchParams.delete("index");
    }

    urlObj.searchParams.set("t", `${timestamp}s`);
    return urlObj.toString();
  }

  // Create a base URL object with just the "v" and optional "list" search parameters
  function createBaseUrl(url) {
    const baseUrlObj = new URL(url);

    const baseUrlParamEntries = Array.from(baseUrlObj.searchParams.entries());
    baseUrlParamEntries.forEach(([key]) => {
      if (key !== "v" && key !== "list") {
        baseUrlObj.searchParams.delete(key);
      }
    });

    return baseUrlObj.toString();
  }

  async function checkIfSameTimestampExists(folderId, bookmarkUrl) {
    const folderChildren = await chrome.bookmarks.getChildren(folderId);
    return folderChildren.some((node) => node.url === bookmarkUrl);
  }

  // If a bookmark of the same video exists with a different timestamp, delete it
  async function deleteIfDifferentTimestampsExist(folderId, baseUrl) {
    const folderChildren = await chrome.bookmarks.getChildren(folderId);
    const baseUrlObj = new URL(baseUrl);

    const bookmarkNodesToDelete = folderChildren.filter((node) => {
      if (!node.url) return false;
      const nodeUrlObj = new URL(node.url);

      const doesVideoIdMatch =
        nodeUrlObj.searchParams.get("v") === baseUrlObj.searchParams.get("v");

      const doesListIdMatch =
        nodeUrlObj.searchParams.get("list") ===
        baseUrlObj.searchParams.get("list");

      return (
        nodeUrlObj.origin === baseUrlObj.origin &&
        doesVideoIdMatch &&
        doesListIdMatch
      );
    });

    await Promise.all(
      bookmarkNodesToDelete.map((node) => chrome.bookmarks.remove(node.id)),
    );
  }

  console.log("Current tab:", tab.id);
  if (!tab.id || !tab.url?.includes("youtube.com/watch")) {
    console.log("Not a YouTube video");
    return;
  }

  const results = await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: async () => {
      const createBaseUrl = (url) => {
        const baseUrlObj = new URL(url);

        const baseUrlParamEntries = Array.from(
          baseUrlObj.searchParams.entries(),
        );
        baseUrlParamEntries.forEach(([key]) => {
          if (key !== "v" && key !== "list") {
            baseUrlObj.searchParams.delete(key);
          }
        });

        return baseUrlObj.toString();
      };

      const createTimestampedBookmarkUrl = (url, timestamp) => {
        const urlObj = new URL(url);

        // Remove the "index" parameter if it exists
        if (urlObj.searchParams.get("index")) {
          urlObj.searchParams.delete("index");
        }

        urlObj.searchParams.set("t", `${timestamp}s`);
        return urlObj.toString();
      };

      const video = document.querySelector("video");
      if (!video) return null;

      const currentUrl = window.location.href;
      const timestamp = Math.floor(video.currentTime);
      const bookmarkUrl = createTimestampedBookmarkUrl(currentUrl, timestamp);

      return {
        baseUrl: createBaseUrl(currentUrl),
        bookmarkUrl,
        title: document.title,
        timestamp: timestamp,
      };
    },
  });

  const result = results?.[0]?.result;
  if (!result) {
    console.log("No video found");
    return;
  }
  // console.log("Result from content script:", result);

  const folderId = "2";
  const bookmarkTitle = `${result.title} - ${result.timestamp}s`;

  const alreadyExists = await checkIfSameTimestampExists(
    folderId,
    result.bookmarkUrl,
  );
  if (alreadyExists) {
    console.log("Bookmark already exists in folder, skipping:", bookmarkTitle);
    return;
  }

  // Delete bookmarks of the same video with earlier timestamps
  await deleteIfEarlierTimestampsExist(
    folderId,
    result.baseUrl,
    result.timestamp,
  );

  await chrome.bookmarks.create({
    parentId: folderId,
    title: bookmarkTitle,
    url: result.bookmarkUrl,
  });

  console.log("Bookmark created for URL:", result.bookmarkUrl);
});
