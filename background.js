import {
  createTimestampedUrl,
  doesSameTimestampExists,
  updateIfDifferentTimestampsExist,
} from "./utils.js";

chrome.action.onClicked.addListener(async (tab) => {
  console.log("Current tab:", tab.id);
  if (!tab.id || !tab.url?.includes("youtube.com/watch")) {
    console.log("Not a YouTube video");
    return;
  }

  const results = await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: async () => {
      const video = document.querySelector("video");
      if (!video) return null;

      return {
        title: document.title,
        currentUrl: window.location.href,
        timestamp: Math.floor(video.currentTime),
      };
    },
  });

  const result = results?.[0]?.result;
  if (!result) {
    console.log("No video found");
    return;
  }

  const folderId = "2";
  const bookmarkUrl = createTimestampedUrl(result.currentUrl, result.timestamp);
  const bookmarkUrlObj = new URL(bookmarkUrl);
  const bookmarkTitle = `${result.title} - ${result.timestamp}s`;

  const alreadyExists = await doesSameTimestampExists(folderId, bookmarkUrlObj);
  if (alreadyExists) {
    console.log("Bookmark already exists in folder, skipping:", bookmarkTitle);
    return;
  }

  const updated = await updateIfDifferentTimestampsExist(
    folderId,
    bookmarkUrlObj,
    bookmarkTitle,
  );
  if (updated) {
    console.log("Bookmark updated for URL:", bookmarkUrl);
    return;
  }

  await chrome.bookmarks.create({
    parentId: folderId,
    title: bookmarkTitle,
    url: bookmarkUrl,
  });

  console.log("Bookmark created for URL:", bookmarkUrl);
});
