var newBottomKey;
var newLinkKey;

//saves new key options
function saveOptions(e) {
  console.log("saving options");
  e.preventDefault();

  if (newBottomKey != undefined) {
    chrome.storage.local.set({
      bottomKey: newBottomKey
    });
  }
  if (newLinkKey != undefined) {
    chrome.storage.local.set({
      linkKey: newLinkKey
    });
  }
}

//resets keys and domain to defaults/none
function resetOptions(e) {
  console.log("resetting options");
  e.preventDefault();

  chrome.runtime.sendMessage({ greeting: "unlock domain" });

  chrome.storage.local.set(
    {
      bottomKey: { mod: "Ctrl", key: "x" },
      linkKey: { mod: "Ctrl", key: "z" },
      domain: undefined,
      domainLocked: false
    },
    function() {
      restoreOptions();
    }
  );
}

//called when first loaded
//sets options to current values
function restoreOptions() {
  let bottomInput = document.getElementById("bottomInput");
  let linkInput = document.getElementById("linkInput");

  //captures key pressed when these elements are selected
  bottomInput.onkeypress = e => {
    newBottomKey = processInputOnKeyPress(e, bottomInput);
    e.preventDefault();
  };

  linkInput.onkeypress = e => {
    newLinkKey = processInputOnKeyPress(e, linkInput);
    e.preventDefault();
  };

  // generic - sets value of an inputfield based on key presses
  // can I used e.target instead of sending input field again?
  // probably better way to do this
  function processInputOnKeyPress(e, inputField) {
    let result = "";
    let resultObj = {};

    if (e.ctrlKey) {
      result += "Ctrl + ";
      resultObj["mod"] = "Ctrl";
    } else if (e.altKey) {
      result += "Alt + ";
      resultObj["mod"] = "Alt";
    } else if (e.metaKey) {
      result += "Meta + ";
      resultObj["mod"] = "Meta";
    } else {
      resultObj["mod"] = "";
    }

    result = result + e.key;
    resultObj["key"] = e.key;
    inputField.value = result;
    return resultObj;
  }

  //sets the starting value of both input fields from result from local storage
  function setCurrentChoice(result) {
    let bottomKey = result.bottomKey;
    let linkKey = result.linkKey;

    bottomInput.value = `${bottomKey.mod} + ${bottomKey.key}`;

    linkInput.value = `${linkKey.mod} + ${linkKey.key}`;
  }

  function onError(error) {
    console.log(`Error: ${error}`);
  }

  chrome.storage.local.get(["bottomKey", "linkKey"], setCurrentChoice);
}

//resets the domain, tells background to forget whatever it had
function resetDomain(e) {
  chrome.runtime.sendMessage({ greeting: "unlock domain" }, function(response) {
    console.log(response.response);
  });

  chrome.storage.local.set({
    domain: undefined,
    domainLocked: false
  });
}

//Takes a txt file with JSON for new pattern and tries to use it
//TODO comment this better - fr has interesting callbacks
function useNewPattern(e) {
  console.log("saving new Patterns");
  let selectedFile = document.getElementById("newPatternInput").files[0];
  var fr = new FileReader();

  // called when successful? need to check exactly TODO
  // at a glance, this will save even if a bad pattern is loaded
  // does this need to be changed?
  fr.onload = function(e) {
    chrome.storage.local.set({
      patternLinkers: fr.result
    });

    chrome.runtime.sendMessage(
      { greeting: "sending new patternLinker", patternLinkerRaw: fr.result },
      function(response) {
        console.log(response.response);
        if (!response.newPatternSet) {
          console.log("pattern change aborted");
          alert("issue with new pattern - no change made");
        } else {
          console.log("pattern changed");
        }
      }
    );
  };

  fr.readAsText(selectedFile);
}

//reset the patterns to default
function resetPatterns() {
  console.log("resetting patterns");
  chrome.storage.local.set({
    patternLinkers: undefined
  });
  chrome.runtime.sendMessage({ greeting: "reset patterns" });
}

document.addEventListener("DOMContentLoaded", restoreOptions);
document
  .getElementById("resetDomainButton")
  .addEventListener("click", resetDomain);
document.querySelector("form").addEventListener("submit", saveOptions);
document.querySelector("form").addEventListener("reset", resetOptions);
document
  .getElementById("useNewPatternButton")
  .addEventListener("click", useNewPattern);
document
  .getElementById("resetPLCButton")
  .addEventListener("click", resetPatterns);
