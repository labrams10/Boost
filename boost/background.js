const action_msg = "action clicked";
const command_msg = "command pressed";
const sending_pattern_msg = "sending PLC";
//default pattern for minimum functionality on first install
// '/' in string double escaped, parsed to string then to regex. probably a better way to do this but it works
const default_pattern =
  '{\n\t"home pattern": {\n\t\t"pattern": "H#(\\\\d{1,8})",\n\t\t"link": "homes/#placeholder#",\n\t\t"linkText": "Home#: "\n\t},\n\t\n\t"phone pattern": {\n\t\t"pattern": "\\\\(?(\\\\d{3})\\\\)?(?: |\\\\-)*(\\\\d{3})\\\\-?(\\\\d{4})",\n\t\t"link": "homes?page=1&homes_filter[phone_number_cond]=eq&homes_filter[phone_number]=#placeholder#",\n\t\t"linkText": "Phone#: "\n\t},\n\t\n\t"project pattern": { \n\t\t"pattern": "(?:^|\\\\b)(3\\\\d)\\\\-?(\\\\d{5})\\\\b",\n\t\t"link": "projects?q[project_number_eq]=#placeholder#",\n\t\t"linkText": "Project#: "\n\t},\n\n\t"appointment pattern": {\n\t\t"pattern": "(?:^#?|\\\\s|[^ht]#)([0-2|4-9]\\\\d{4,7})\\\\b",\n\t\t"link": "homes?homes_filter[lead_id_cond]=eq&homes_filter[lead_id]=#placeholder#",\n\t\t"linkText": "Appt #: " \n\n\t},\n\n\t"ticket pattern": {\n\t\t"pattern": "\\\\b(?:t(?:icket)? ?#? ?)(\\\\d+)\\\\b",\n\t\t"link": "support/tickets/#placeholder#",\n\t\t"linkText": "Ticket #:"\n\t}\n}';

console.log("BG Loaded");

/*
Called when there was an error.
We'll just log the error here.
*/
function onError(error) {
  console.log(`Error: ${error}`);
}

//container used to holder patterns and the associated links to fill with matches
var patternLinkerContainer = false;
//recently made matches
var recentMatches = [];
//used to enable the page action to set the domain to use
var domainLocked = false;
//tabs which have the page action shown, used to know which to tell to hide it
var tabsWithPageActionIndexes = [];
var tabsURLInfo = {}; //TODO maybe unused? refactored out probably
//obj keeping track of which windows have the bottom bar open or closed
//int key, boolean value for obj like { openStatus: true }
var windows = {};

(function setup() {
  //listens for changes in tabs mostly for pages that reload w/o changes url
  //needed to keep bottom in sync across pages that dont fully reload when navigating around
  chrome.tabs.onUpdated.addListener(function(tabID, changeInfo, tab) {
    if (changeInfo.status) {
      chrome.tabs.sendMessage(
        tabID,
        {
          greeting: "check bottom",
          bottomOpen: getWindowOpenStatus(tab.windowId)
        },
        function(response) {
          console.log(response.response);
        }
      );
    }
  });

  //checks storage to see if defaults need to be set(as well as some setup)
  chrome.storage.local.get(
    ["domain", "domainLocked", "bottomKey", "linkKey", "patternLinkers"],
    function(response) {
      domainLocked = response.domainLocked;
      let domain = response.domain;

      setupPatternLinkers();

      if (domain != undefined) {
        changePatternLinkerDomain(domain);
      }

      let patternLinkers = response.patternLinkers;

      if (patternLinkers != undefined) {
        let newPatternLinkers = rawPatternLinkerParser(patternLinkers);
        if (newPatternLinkers) {
          //false if parse was bad
          changePatterns(newPatternLinkers);
        }
      }

      let bottomKeyDefault = { mod: "Ctrl", key: "x" };
      let linkKeyDefault = { mod: "Ctrl", key: "z" };
      let defaultsToSet = {};
      if (response.bottomKey == undefined) {
        defaultsToSet["bottomKey"] = bottomKeyDefault;
      }

      if (response.linkKey == undefined) {
        defaultsToSet["linkKey"] = linkKeyDefault;
      }

      if (Object.keys(defaultsToSet).length > 0) {
        console.log("setting defaults");
        chrome.storage.local.set(defaultsToSet, function() {
          console.log("Defaults set");
        });
      }
    }
  ); //Storage get and callback function
})(); //setup IIFE

//changes the domain to be used when making links
function changePatternLinkerDomain(newDomain) {
  if (patternLinkerContainer != false) {
    patternLinkerContainer.domain = newDomain;
  }
}

//sets up pattern linker using domain
function setupPatternLinkers(newDomain) {
  patternLinkerContainer = new Object();

  changePatterns(rawPatternLinkerParser(default_pattern));

  patternLinkerContainer["placeholder"] = "#placeholder#";
}

/*
  adds a listener to messages, specifically any to chrome.runtime
*/
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log("msg recieved: " + request.greeting);
  //use same object response, fill it depending on message
  let answer = new Object();
  var response = "response: ";

  switch (request.greeting) {
    case "reset patterns":
      setupPatternLinkers();
      break;

    case "sending new patternLinker":
      let newPatternLinkers = rawPatternLinkerParser(request.patternLinkerRaw);
      if (newPatternLinkers) {
        //false if parse was bad
        changePatterns(newPatternLinkers);
        response += "new pattern set";
        answer.newPatternSet = true;
      } else {
        response += "issue with new pattern";
        answer.newPatternSet = false;
      }

      break;

    case "get bottom open":
      answer.bottomOpen = getWindowOpenStatus(sender.tab.windowId);
      response += "returning if open bottom";
      break;

    case "clear Recent":
      response += "clearing recent OK";
      recentMatches = [];
      break;

    case "open bottom":
      console.log(sender.tab.windowId);
      response += "Open bottom OK";
      //bottomOpen = true;
      setWindowOpenStatus(sender.tab.windowId, true);
      sendMessageToAllTabs({ greeting: request.greeting });
      break;

    case "close bottom":
      response += "close bottom OK";
      setWindowOpenStatus(sender.tab.windowId, false);
      sendMessageToAllTabs({ greeting: request.greeting });
      break;

    case "toggle bottom":
      response += "toggle bottom OK";
      let bottomOpen = !getWindowOpenStatus(sender.tab.windowId);
      setWindowOpenStatus(sender.tab.windowId, bottomOpen);
      sendMessageToAllTabs({
        greeting: request.greeting,
        bottomOpen: bottomOpen
      });
      break;

    case "get Recent":
      response += "sending recent";
      answer.value = recentMatches;
      break;

    case "unlock domain":
      response += "unlocking domain";
      //TODO maybe need to set localstorage value here
      domainLocked = false;
      break;

    //may be unused? TODO
    case "get PLC":
      response += "returning patt linker con";
      answer["patternLinkerContainer"] = patternLinkerContainer;
      console.log("BG" + response);
      break;

    //tab checking in to see if page action button should be shown
    case "try pageAction":
      if (tryPageAction()) {
        response += "pageAction Shown";
        chrome.pageAction.show(sender.tab.id);
        tabsWithPageActionIndexes.push(sender.tab.id);
      } else {
        response += "no PA: domain locked";
      }
      break;

    case "get links":
      response += "returning links";
      answer["links"] = buildLinksFromInput(request.value, request.domain);
      console.log("returning links " + answer);
      break;

    default:
      response += "unknown message";
      console.log("unknown message: " + request.greeting);
      break;
  }
  console.log("sending response: " + response);
  answer["response"] = response;
  sendResponse(answer);
});

//sends msg to all tabs in current active window
function sendMessageToAllTabs(msg) {
  chrome.tabs.query({ currentWindow: true }, function(tabs) {
    for (let i = 0; i < tabs.length; i++) {
      chrome.tabs.sendMessage(tabs[i].id, msg);
    }
  });
}

function changePatterns(newPatternLinkers) {
  patternLinkerContainer.patternLinkers = newPatternLinkers;
}

/*
  attempts to parse a string into a new pattern linker.
  returns false if it was un able to 
*/
function rawPatternLinkerParser(rawText) {
  try {
    var newPatternLinker = JSON.parse(rawText);
    for (thisPattern in newPatternLinker) {
      let currPattern = newPatternLinker[thisPattern];
      //checks if this pattern is valid. if not, throws exception
      if (!validatePatternLinker(currPattern)) {
        throw "Badly formed";
      }
      //change the string pattern to Regex
      newPatternLinker[thisPattern].pattern = new RegExp(
        currPattern.pattern,
        "igm"
      );
    }
  } catch (e) {
    //catch the error and return false
    onError(e);
    newPatternLinker = false;
  }

  return newPatternLinker;
}

//checks that what we are trying to parse as a pattern linker has all the required fields
function validatePatternLinker(patternLinker) {
  let isValid = false;
  if (patternLinker.pattern && patternLinker.linkText && patternLinker.link) {
    isValid = true;
  }
  return isValid;
}

//checks if we have a record for the given window already
//if we dont, create one
//either way, set the open status of the window to whatever was given
//open status refers to the status of the bottom bar for that window
function setWindowOpenStatus(windowId, isOpen) {
  if (windows[windowId] != undefined) {
    windows[windowId].openStatus = isOpen;
  } else {
    windows[windowId] = { openStatus: isOpen };
  }
}

//checks if the current window exists in our collection of windows, and if the bottom bar is open for that window
function getWindowOpenStatus(windowId) {
  let currWindow;
  if (windows[windowId] != undefined) {
    currWindow = windows[windowId];
  } else {
    //default to closed, let setter handler default
    setWindowOpenStatus(windowId, false);
    currWindow = windows[windowId];
  }

  return currWindow.openStatus;
}

/*
  Sets listener for page action
*/
chrome.pageAction.onClicked.addListener(() => {
  console.log("action clicked");

  chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
    chrome.tabs.sendMessage(tabs[0].id, { greeting: action_msg }, function(
      response
    ) {
      if (response.domain_lock_needed) {
        lockDomain(response.domain);
      }
      console.log(response.response);
    });
  });

  //when pageaction is clicked, lock the domain and hide all current page actions
  function lockDomain(domain) {
    changePatternLinkerDomain(domain);
    //local storage is checked when first opening browser
    chrome.storage.local.set({ domain: domain, domainLocked: true });
    domainLocked = true;

    for (let i = 0; i < tabsWithPageActionIndexes.length; i++) {
      chrome.pageAction.hide(tabsWithPageActionIndexes[i]);
    }
    tabsWithPageActionIndexes = [];
  }
});

//takes an array of strings and finds all the links that match the text
function buildLinksFromInput(textArr, domain) {
  //if given a single string, treat it as an array and proceed
  if (!(textArr instanceof Array)) {
    textArr = [textArr];
  }

  //accumulate all the links to return
  let result = [];

  //go through each string in the array
  for (let i = 0; i < textArr.length; i++) {
    let item = textArr[i];
    let links = linksFromText(item, domain);

    //if there are any results
    if (links.length > 0) {
      //for each result for this string
      for (let i = 0; i < links.length; i++) {
        //add each match to the result array
        result.push(links[i]);

        //links saved in history
        let thisMatchIndex = recentMatches.indexOf(links[i]);

        if (thisMatchIndex >= 0) {
          //-1 if no match
          console.log("DUPE"); //if dupe, remove from array and put in front
          recentMatches.splice(thisMatchIndex, 1);
          recentMatches.push(links[i]);
        } else {
          recentMatches.push(links[i]);
        }
      } //for each match
    } //if any results
  } //for each string

  return result;
}

/*
  Checks all patternLinkers in patternLinkers obj against text and returns links for those matches
*/
function linksFromText(text, domainArg) {
  //determines if a specific domain is needed or to use the previously saved one
  let domain = domainArg || patternLinkerContainer.domain;
  //accumulate all the matches
  let results = [];

  //patternLinkers in PLC holds the patterns to match
  for (patt in (patternLinkers = patternLinkerContainer.patternLinkers)) {
    let thisPatt = patternLinkers[patt];
    let matches = getMatchesFromText(text, thisPatt.pattern);
    // for every match, replace the placeholder with the actual number
    for (let i = 0; i < matches.length; i++) {
      //replace placeholder value in link with num from matches
      let res = thisPatt.link.replace(
        patternLinkerContainer.placeholder,
        matches[i]
      );
      res = thisPatt.linkText + linkify(domain, res, matches[i]);
      results.push(res);
    }
  }
  return results;

  /*
    gets all the matches for pattern from text
    returns a concatenation of the capture groups for the patter
    assumes that the capture group collectively concat to the proper number
    inserts a '-' between first and second captured group, if present
      this may need to change, but currently works fine for both projects and phone number
      no other patterns need more than one group thus far.
      maybe implement as a flag? pattern needs dashes between groups
      that could be checked here easily
  */
  function getMatchesFromText(text, pattern) {
    let resultArray;
    let results = [];

    //finds all the  matches in the text for this pattern
    while ((resultArray = pattern.exec(text)) !== null) {
      result = "";

      //index 1,2,3... correspond to capture groups in regex
      for (let i = 1; typeof resultArray[i] !== "undefined"; i++) {
        if (i == 2) {
          result += "-";
        }
        result += resultArray[i];
      }
      results.push(result);
    }
    return results;
  }

  /*
    Takes an address and text for link and builds the tag accordingly
  */
  function linkify(domain, path, textToLink) {
    result =
      '<a target="_blank" href ="' + domain + path + '">' + textToLink + "</a>";

    return result;
  }
}

function tryPageAction() {
  return !domainLocked;
}
