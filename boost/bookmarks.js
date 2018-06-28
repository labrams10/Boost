console.log("bookmarks.js");

let nav = document.querySelector("ol.nav");
let home = document.getElementById("navHome");
let second = home.nextElementSibling;

console.log(home);

console.log(second);
console.log(second.firstElementChild.href);

chrome.storage.local.set({
  testBookmarkStorage: [
    second.firstElementChild.href,
    second.nextElementSibling.firstChild.href
  ]
});

setTimeout(getFromStorage, 3000);

function getFromStorage() {
  chrome.storage.local.get("testBookmarkStorage", function(result) {
    console.log(result.testBookmarkStorage);
  });
}

//INFO - Element.pathname returns the "/support/tickets" bit that is actually listed as the href when inspecting the element
// Assuming that <a> elements list the pathname and build the full link if just given a relative path
