console.log("bottomBar.js loaded");

/*
Called when there was an error.
We'll just log the error here.
*/
function onError(error) {
  console.log(`Error: ${error}`);
}

var bottomKey;
var linkKey;

//setup when loaded
window.onload = () => {
  chrome.storage.local.get(["bottomKey", "linkKey"], function(result) {
    bottomKey = result.bottomKey;
    linkKey = result.linkKey;
  });

  //listeners for close button
  document
    .getElementById("bottomLeftClose")
    .addEventListener("click", closeBottom);
  document
    .getElementById("bottomRightClose")
    .addEventListener("click", closeBottom);

  document.onkeypress = handleKeyPress;

  let input = document.getElementById("smartSearchText");
  input.onfocus = getRecent;

  let clearResultsButton = document.getElementById("clearResultsBtn");
  clearResultsButton.onclick = () => {
    clearRecentDisplay();
    //tells bg to lose recent history
    chrome.runtime.sendMessage({ greeting: "clear Recent" });
  };

  let form = document.getElementById("smartSearchForm");
  form.onsubmit = function(e) {
    console.log("form submitted");
    e.preventDefault();

    formSubmitted(e.target);
    //prevents the normal form submission
    return false;
  };
};

//could probably just use sendToggleMesage instead
//left incase we need to do anything else on close in future
function closeBottom() {
  console.log("closing Bottom");
  sendToggleMessage();
}

//clears results
function clearRecentDisplay() {
  document.getElementById("smartSearchResults").innerHTML = "";
}

//gets the recent matches from BG
function getRecent() {
  clearRecentDisplay(); //clears because it checks and repulls here

  chrome.runtime.sendMessage({ greeting: "get Recent" }, function(response) {
    if (response != undefined) {
      //added same way as when first matched
      addResults(response.value);
    }
  });
}

/*
	gets the value from the input field in the form and processes it
*/
function formSubmitted(form) {
  let value = document.getElementById("smartSearchText").value;
  getLinksFromBG(value);
  form.reset();
}

//gets links made from matches for target value
function getLinksFromBG(targetValue) {
  let msg = { greeting: "get links", value: targetValue };

  chrome.runtime.sendMessage(msg, function(response) {
    let links = response.links;
    if (links.length > 0) {
      addResults(links);
      return true;
    } else {
      noMatches(targetValue);
    }
    return false;
  });
}

//helper method to put message in for no matches
//uses same code as adding result
function noMatches(value) {
  let msgForNoMatches = ["No Match for: " + value];
  addResults(msgForNoMatches);
}

/*
	adds the links in array "links" to the result div
*/
function addResults(links) {
  let resultDiv = document.getElementById("smartSearchResults");

  //TODO check links defined elsewhere? this looks weird to me
  for (let i = 0; links != undefined && i < links.length; i++) {
    let resultLink = document.createElement("DIV");
    resultLink.className = "bottomMidSection";
    resultLink.innerHTML = links[i];
    resultDiv.insertBefore(resultLink, resultDiv.firstChild);
  }
}

function handleKeyPress(event) {
  let key = event.key;
  if (key == bottomKey.key) {
    console.log("bot key matched");
    switch (bottomKey.mod) {
      case "Ctrl":
        if (event.ctrlKey) {
          bottomCommandPressed();
        }
        break;

      case "Alt":
        if (event.altKey) {
          bottomCommandPressed();
        }
        break;

      case "Meta":
        if (event.metaKey) {
          bottomCommandPressed();
        }
        break;

      case "":
        bottomCommandPressed();
        break;
      default:
    }
  }
}

// same as below? TODO investiage this
// leave bottom command pressed, call sentToggleMessage() and leave as separate
// incase I want to do anything else on bottom command in addition later
function bottomCommandPressed() {
  chrome.runtime.sendMessage({ greeting: "toggle bottom" }, function(response) {
    console.log(response.response);
  });
}

//sends message that bottom needs to be toggled
//usually used to close, but if hit twice will reopen
//works nicely
function sendToggleMessage() {
  chrome.runtime.sendMessage({ greeting: "toggle bottom" }, function(response) {
    console.log(response.response);
  });
}
