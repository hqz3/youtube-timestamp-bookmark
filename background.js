chrome.action.onClicked.addListener(async (tab) => {
  console.log("Current tab:", tab.id);
  if (!tab.id || !tab.url?.includes("*://www.youtube.com/watch")) {
    console.log("Not a YouTube video");
    return;
  }

  const results = await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: async () => {
      const video = document.querySelector("video");
      if (!video) return null;

      const currentUrl = window.location.href;
      const t = Math.floor(video.currentTime);
      const urlObj = new URL(currentUrl);
      urlObj.searchParams.set("t", `${t}s`);

      // Delete the "index" search parameter if it exists
      if (urlObj.searchParams.get("index")) {
        urlObj.searchParams.delete("index");
      }

      return {
        bookmarkUrl: urlObj.toString(),
        title: document.title,
        timestamp: t,
      };
    },
  });

  const result = results[0].result;

  const folderId = "2";
  const bookmarkTitle = `${result.title} - ${result.timestamp}s`;

  // Only check this folder for same-title bookmarks with the same timestamp
  const folderChildren = await chrome.bookmarks.getChildren(folderId);
  const alreadyExists = folderChildren.some(
    (node) => node.url === result.bookmarkUrl,
  );

  if (alreadyExists) {
    console.log("Bookmark already exists in folder, skipping:", bookmarkTitle);
    return;
  }

  await chrome.bookmarks.create({
    parentId: folderId,
    title: bookmarkTitle,
    url: result.bookmarkUrl,
  });

  console.log("Bookmark created for URL:", result.bookmarkUrl);
});
