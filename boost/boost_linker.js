//runs on each page

console.log("Content Script Loaded");
//targets not to hit with links
var invalidTargets = [];
//sets the current domain
var currDomain;
//key combo to open bottom bar
var bottomKey;
//key combo to make links at mouse
var linkKey;

/*
Called when there was an error.
We'll just log the error here.
*/
function onError(error) {
  console.log(error);
}

/*
	Sets up the listeners and fetches the PLC from bg
*/
(function() {
  invalidTargets.push(document.body);

  setupDomain();
  setupBottomBar();

  //sets up listener to get command press from BG Script
  chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
    console.log("from bg: " + request.greeting);
    let answer = new Object();
    let response = "response: ";

    switch (request.greeting) {
      case "open bottom": //open used by content script
        console.log("opening bot");
        response += "opening bottom OK";
        if (!checkBottomBarExists()) {
          setupBottomBar();
        }
        if (
          document.getElementById("bottomBar").classList.contains("hideBar")
        ) {
          toggleBottomBar();
          focusBottomBar();
        }
        break;

      case "close bottom": //close used by content script
        console.log("close bottom");
        response += "closing Bottom OK";
        if (checkBottomBarExists() && checkBottomOpen()) {
          toggleBottomBar();
        }
        break;

      case "check bottom":
        console.log("checking bottom");
        checkNeedToShow(request.bottomOpen);
        break;

      case "toggle bottom": //toggle used by side bar
        console.log("toggling bot");
        if (request.bottomOpen && !checkBottomBarExists()) {
          setupBottomBar();
        }
        correctBottomBar(request.bottomOpen);
        break;

      case "action clicked":
        response += "locking domain";
        answer["domain"] = getDomain();
        answer["domain_lock_needed"] = true; //tells bg to lock the domain
        break;

      //maybe not used - TODO check
      //org used command provided by extension manifest, but couldnt customize
      case "command pressed":
        response += "command pressed recieved";
        linkifyAtMouseover();
        break;

      default:
        console.log("unknown msg recieved");
        break;
    }
    answer["response"] = response;
    sendResponse(answer);
  });

  //determines if the bottom bar should be shown on page load
  initialCheckNeedToShow();
  setupPreferenceKeys();
  setupPageAction();

  document.onkeypress = handleKeyPress;
})();

function initialCheckNeedToShow() {
  chrome.runtime.sendMessage({ greeting: "get bottom open" }, function(
    response
  ) {
    checkNeedToShow(response.bottomOpen);
  });
}

//checks if the bar should be open when it becomes visible (i think? investigat TODO)
//makes bar just show immediately, rather than sliding in
function checkNeedToShow(bottomOpen) {
  if (bottomOpen) {
    if (!checkBottomBarExists()) {
      setupBottomBar();
    }
    let bottomBar = document.getElementById("bottomBar");
    let spacingDiv = document.getElementById("spacingDiv");
    bottomBar.classList.remove("slide");
    bottomBar.classList.remove("hideBar");
    spacingDiv.classList.remove("hideBar");
    bottomBar.classList.add("slide");
  }
}

//checks to see that a node is valid
//if it is, adds to list so it wont be again
function validateNode(elem) {
  if (invalidTargets.includes(elem)) {
    return false;
  }

  invalidTargets.push(elem);
  return true;
}

/**
	Gets the most specific html element at the mouse
	pulls all the children elements of that element
	Adds links after elem if they contain text that match a pattern set in setup
	Sets all nodes to invalid targets once they are visited once to avoid dups
*/
function linkifyAtMouseover() {
  let target = getMouseoverElement();
  let nextArray = [target];
  let textToSend = [];

  //loops through nodes -elem add children to list, text check for matches
  while (nextArray.length > 0) {
    let node = nextArray.pop();
    if (!validateNode(node)) node = false; //if node is not valid, dont eval it at all
    switch (node.nodeType) {
      case Node.ELEMENT_NODE:
        let children = node.childNodes;
        //adds the children nodes of current node that need to be checked
        children.forEach(function(currentChild, currentIndex, children) {
          //elem = 1, text = 3, 2 depricated. checks that node is good to use
          if (currentChild.nodeType <= 3) {
            nextArray.push(currentChild);
          }
        });
        break;
      case Node.TEXT_NODE:
        //add the current node to the array of nodes to check
        textToSend.push(node.nodeValue);
        break;
    } //switch
  } //while

  //sends text to the background and puts results after target
  (function sendTextToBG(textArr, target) {
    var resultDiv;
    msg = { greeting: "get links", value: textArr, domain: currDomain };

    chrome.runtime.sendMessage(msg, function(response) {
      console.log("resp: " + response);
      let resultDiv = buildResultDiv();
      let links = response.links; //get from result eventually

      for (let i = 0; i < links.length; i++) {
        let thisDiv = document.createElement("DIV");
        thisDiv.innerHTML = links[i];
        //inserts the matched link in the result div
        addToResult(resultDiv, thisDiv);

        //puts the div and the link elems into invalid targets so you cant make links from links
        invalidTargets.push(thisDiv);
        invalidTargets.push(thisDiv.childNodes[1]);
      }

      if (resultDiv.childNodes[1].firstChild !== null) {
        //if any links have been added
        target.parentNode.insertBefore(resultDiv, target.nextSibling); //add result div to dom after target
      }
    });
  })(textToSend, target);
}

//builds the div to hold results
function buildResultDiv() {
  let resultDiv = document.createElement("DIV");
  resultDiv.className = "BLresult";
  invalidTargets.push(resultDiv);

  let title = document.createElement("DIV");
  title.className = "BLtitle";
  title.innerHTML = "Boost Links:";
  resultDiv.appendChild(title);
  invalidTargets.push(title);

  let itemsDiv = document.createElement("DIV");
  itemsDiv.className = "BLitems";
  resultDiv.appendChild(itemsDiv);
  invalidTargets.push(itemsDiv);

  return resultDiv;
}

//appends "elem" to the proper place in  "resultDiv"
function addToResult(resultDiv, elem) {
  resultDiv.childNodes[1].appendChild(elem);
}

/*
	returns the most specific element at the mouse
*/
function getMouseoverElement() {
  var items = document.querySelectorAll(":hover");

  if (items.length > 0) {
    item = items[items.length - 1];
    return item;
  }
  return null;
}

//sets up the bottom bar
//spacing div allows scrolling if not enough content, prevents bar from permenantly covering anything
function setupBottomBar() {
  let bottomBar = document.createElement("DIV");
  let spacingDiv = document.createElement("DIV");
  let body = document.querySelector("Body");

  spacingDiv.id = "spacingDiv";
  bottomBar.id = "bottomBar";
  spacingDiv.classList.add("hideBar");
  bottomBar.classList.add("hideBar");

  body.appendChild(spacingDiv);
  body.appendChild(bottomBar);

  let bottomFrame = document.createElement("IFRAME");
  bottomFrame.id = "bottomFrame";
  resizeBottomBar(bottomFrame, bottomBar);

  //loads the bottom bar html into the frame
  bottomFrame.src = chrome.extension.getURL("bottomBar.html");
  bottomBar.appendChild(bottomFrame);

  window.addEventListener("resize", resizeThrottler, false);

  var resizeTimeout;
  function resizeThrottler() {
    // ignore resize events as long as an actualResizeHandler execution is in the queue
    if (!resizeTimeout) {
      resizeTimeout = setTimeout(function() {
        resizeTimeout = null;
        resizeBottomBar(bottomFrame, bottomBar);

        // The actualResizeHandler will execute at a rate of 15fps
      }, 66);
    }
  }
}

//actual handling of the bottom bar resizing
function resizeBottomBar(frame, bar) {
  let bottomFrame = frame || window.getElementById("bottomFrame");
  let bottomBar = bar || document.getElementById("bottomBar");
  bottomFrame.width = `${bottomBar.clientWidth} + px`;
  bottomFrame.height = "80px";
}

//gets preferences from local storage
function setupPreferenceKeys() {
  chrome.storage.local.get(["bottomKey", "linkKey"], function(result) {
    bottomKey = result.bottomKey;
    linkKey = result.linkKey;
  });
}

//checks to see if key combo matches saved
//probably a better way to do this
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

  if (key == linkKey.key) {
    switch (linkKey.mod) {
      case "Ctrl":
        if (event.ctrlKey) {
          linkCommandPressed();
        }

        break;
      case "Alt":
        if (event.altKey) {
          linkCommandPressed();
        }
        break;
      case "Meta":
        if (event.metaKey) {
          linkCommandPressed();
        }
        break;
      case "":
        linkCommandPressed();
        break;
      default:
    }
  }

  function bottomCommandPressed() {
    if (!checkBottomBarExists()) {
      //setupBottomBar();
      chrome.runtime.sendMessage({ greeting: "open bottom" });
    } else {
      //sends message to bg so all tabs get cmd
      if (checkBottomOpen()) {
        chrome.runtime.sendMessage({ greeting: "close bottom" });
      } else {
        chrome.runtime.sendMessage({ greeting: "open bottom" });
      }
    }

    event.preventDefault();
  }

  function linkCommandPressed() {
    linkifyAtMouseover();
    event.preventDefault();
  }
}

//returns if the bottom bar is currently open or not
function checkBottomOpen() {
  let bottomBar = document.getElementById("bottomBar");
  let open = true;
  if (bottomBar.classList.contains("hideBar")) {
    open = false;
  }

  return open;
}

//toggles the open state of the bottom bar
function toggleBottomBar() {
  let bottomBar = document.getElementById("bottomBar");
  let spacingDiv = document.getElementById("spacingDiv");

  //if on screen, slide nicely, otherwise hide immediately
  //otherwise animate will play when tab is opened, looks bad
  if (document.hasFocus()) {
    bottomBar.classList.add("slide");
    spacingDiv.classList.add("slide");
  } else {
    bottomBar.classList.remove("slide");
    spacingDiv.classList.remove("slide");
  }

  bottomBar.classList.toggle("hideBar");
  spacingDiv.classList.toggle("hideBar");

  //if bar is open, focus it after slide is done
  if (!bottomBar.classList.contains("hideBar")) {
    setTimeout(focusBottomBar, 5);
  }
}

//focus the bottom bar so that you can type into search immediately
function focusBottomBar() {
  let bottomBar = document.getElementById("bottomBar");

  try {
    //works in FF
    bottomBar.firstChild.contentWindow.document
      .getElementById("smartSearchText")
      .focus();
  } catch (e) {
    //works in chrome, above not permitted in chrome?
    bottomBar.firstChild.contentWindow.focus();
  }
}

function setupDomain() {
  if (currDomain == undefined) {
    currDomain = getDomain();
  }
}

//gets the current domain from the url of the page
function getDomain() {
  let domain = /https?:\/\/(?:www.)?\S{1,30}.com\/|file:\/\/\/\S*.html/i.exec(
    document.URL
  )[0];
  return domain;
}

//sends a msg to bg to turn page action on if needed
//BG handles rest
function setupPageAction() {
  chrome.runtime.sendMessage({ greeting: "try pageAction" }, function(
    response
  ) {
    console.log(response.response);
  });
}

function checkBottomBarExists() {
  return document.getElementById("bottomBar") != null;
}

//bottomOpen is state bar should be in
//corrects if not what it needs to be
function correctBottomBar(bottomOpen) {
  let isVisible = !document
    .getElementById("bottomBar")
    .classList.contains("hideBar");
  if (isVisible != bottomOpen) {
    toggleBottomBar();
  }
}
