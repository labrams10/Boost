# BOOST

This is a firefox/chrome extension, build to allow users of a rails application to take advantage of the regularity of the URLs generated to find different pages for different types of data

## how to

There are two commands: Make Link at Mouse and Open Bottom Bar

Make link at mouse takes all the text at the most specific element at the mouse
It then tried to match patterns against the text to determine if it needs to build links

Open Bottom Bar opens the a bottom bar, which has a search field that checks the same patterns as the other command, and also displays all recent matches

## Options

if you nagivate to about:addons, you see a list of installed addons, and can access preferences for Boost here
You can set the key combinations for the commands listed above here
You can reset the domain the app is locked to here
You can import new patterns to match here
You can reset the patterns, or all options as well

## how to structure the JSON for config for patterns

    patternLinkers: {
    	"some pattern linker": {
    		pattern: Regex pattern with a capture group,
    		link: "path/to/put/after/domain/#placeholder#",
    		linkText: "text that is shown:"
    	},

    	"appointment pattern": {
    		pattern: /some pattern that matches appointments A#(12345)/,
    		link: "/search/appointments/#placeholder#/",
    		linkText: "Appt #: "
    	}
    }

    IE: if i tried to link to A#12345 the result would be
    Appt #: 12345  where the 12345 is a link to DOMAIN/search/appointments/12345

# Domain lock

Rather than hard code in a domain or pattern for domain, I leave it up to the user to set the domain when the extension is first loaded. This allows the extension to be used in demo environments as well as production

When the extension is first loaded, no domain is set. The At-Mouse action will make a link and use whatever the current domain is at the moment. The bottom bar search will use whatever domain was last used by the At-Mouse command until one is set

To set the domain, the user has to click the Page Action that is the B boost icon near the URL
In firefox, the button can be hidden and will not appear once it is pressed once.
In Chrome, the button becomes greyed out, and I don't believe there is a good way to hide it

## Extension basics

One Background script runs for the entire browse. A content script runs in each page, in this extension that script is called boost_linker.js.

The background script controls whether or not the page action is visible, captures it being pressed, and does the pattern matching. The background script has the pattern-linker-container which describes how to check for patterns and how to display the matches

The content script checks where the mouse is when needed, controls the display of the bottom bar, gets the text to check against and sends it to the bottom bar. It also inserts the results into the DOM to display the links

How these are loaded is controlled by the manifest.json

"background" key defines scripts or bg page to run in background of the browser
if you use a page, you cant use a script
background.html is unused but would be for that, it can load a script like normal

"content_scripts" key controls what loads in each page
can use a pattern to only load in certain pages
currently setup to load "boost_linker.js" in all pages

"options_ui" key controls options page accessed when looking at the extensions options

Content Scripts have access to limited APIs but can see the current pages DOM
To use other APIs provided by browser, you need to pass info to BG script with messages

BG script can only communicate with content script by passing a message to a particular tab

The bottom bar contains an iframe, which loads bottomBar.html, which in turn loads bottomBar.js
This has to communicate to the other scripts via messages as well

## Firefox and promises

I had written most of the extension using promises and browser.runtime instead of chrome.runtime
But it turns out that firefox allows you to use chrome.runtime (which uses callbacks instead of promises)
In doing so, 99% of the code works in chrome and firefox
IIRC, there is only one place where I had to account for a difference in behavior, related to making the bottom bar get focus when it is opened

I haven't repackaged this for chrome in a few versions, and I think I might have had to make a few tweaks before it would work. It wasn't anything major, but I'll be sure to document the process (and maybe automate it if possible) next time. I vaguely remember changing some manifest keys slightly to make it work

## Janky Key press capturing

Extensions allow you to define commands, which are key press combinations, via the manifest, and then listen for those in a more formal way
I believe chrome allows you to customize these through an options UI, but firefox didnt
So I opted to try and do it my self, and it works well enough
The only Caveat is that I trust the user to not pick something that overlaps build in commands
I dont check for anything like that, and trust the user to change it if it is a problem

## Developing an addon

To load an unpacked addon in firefox,
navigate to about:debugging in the browser
select "Load Temporary Add-on", and then choose any file in the same folder as the manifest.json

To load an unpacked addon in chrome,
navigate to chrome://extension,
Turn on developer tools,
Select the Directory that includes the manifest

You have to be careful when using this approach to test changes.
TODO Will need to document which types of pages (content, bg, ect) reflect changes when

Reloading the addon restarts the background script, and loads the content script into the appropriate pages
Other scripts, such as the options, just need the page they are on to be opened in a new tab

## Packaging a FF extension

To package a FF extension you must zip archive all the files referenced in the manifest.json as well as any other files needed (images, html pages loaded by those in the manifest, ect)

For this project, at the moment that includes the following files:
backgrounds.js
boostlinker.js
bottombar.html
bottombar.js
linker.css
manifest.json
options.html
options.js

This zip archive has to be sent through addons.mozilla.org to be reviewed
This review will point out any errors or warnings
It is automated, and takes about 5 seconds
The version of boost has to be incremeted or it will yell at you and say you are uploading an old version or something like that
I need to do a better job of deciding when to go from 2.4.1 to 2.5.1 or 2.4.2 ect, its been mostly random up to this point
