/*-
 * Copyright (C) 2019 - 2020 Volodymyr Leno, Apromore Pty Ltd.
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Lesser General Public License as
 * published by the Free Software Foundation, either version 3 of the
 * License, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Lesser Public License for more details.
 *
 * You should have received a copy of the GNU General Lesser Public
 * License along with this program.  If not, see
 * <http://www.gnu.org/licenses/lgpl-3.0.html>.
 */
// triggers every time a new page is activated.
//chrome.tabs.onActivated.addListener(function () { printUrl("tab_activated") });

//chrome.webNavigation.onBeforeNavigate.addListener(logOnBefore);
// very spammy!

var tabTitles = new Map();
var tabUrls = new Map();

// chrome.windows.onFocusChanged.addListener(function () { printUrl("focus_window_changed") });
chrome.webNavigation.onCommitted.addListener(navigation);
//chrome.tabs.onRemoved.addListener('beforeunload', function () { printUrl("tab_closed") });

chrome.tabs.onActivated.addListener(handleActivation);
chrome.tabs.onRemoved.addListener(handleRemoval);

//connect runtime
var portFromCS;
chrome.runtime.onConnect.addListener(connected);

function connected(p) {
    portFromCS = p;
    portFromCS.onMessage.addListener(function (m) {

        console.log(m);
        m.targetApp = "Chrome";
        postRest(m);
    });
}

chrome.windows.getAll({populate:true},function(windows){ 
  windows.forEach(function(window){
    window.tabs.forEach(function(tab){
      tabTitles.set(tab.id, tab.title);
	  tabUrls.set(tab.id, tab.url);
    });
  });
});

function handleActivation(){
	chrome.tabs.query({ 'active': true, 'lastFocusedWindow': true }, function (tabs) {
		try{
			var tabUrl = tabs[0].url;
			var tabTitle = tabs[0].title;
			var tabId = tabs[0].id;
			if (!tabTitles.has(tabId)) {
				//currentTabs.set(tabId, new TabInfo(tabTitle, tabUrl));
				tabTitles.set(tabId, tabTitle);
				tabUrls.set(tabId, tabUrl);
				var req = { timeStamp: new Date(Date.now()), targetApp: "Chrome", eventType: "createNewTab", url: tabUrl, target: {id: tabId, title: tabTitle} };				
            } else {
                var req = { timeStamp: new Date(Date.now()), targetApp: "Chrome", eventType: "selectTab", url: tabUrl, target: {id: tabId, title: tabTitle} };
            }
            console.log(req);
            postRest(req);
		}
		catch(error){
			console.log("Platform not supported");
		}
	});
}

function handleRemoval(){
	chrome.tabs.query({ 'lastFocusedWindow': true }, function (tabs) {
		try{
			var tabsID = new Array();
			for(i = 0; i < tabs.length; i++)
				tabsID.push(tabs[i].id);
			
			var initialTabs = Array.from(tabTitles.keys());
			
			for(i = 0; i < initialTabs.length; i++){				
				if(!tabsID.includes(initialTabs[i])){
					var tabUrl = tabUrls.get(initialTabs[i]);
					var tabTitle = tabTitles.get(initialTabs[i]);
					var req = { timeStamp: new Date(Date.now()), targetApp: "Chrome", eventType: "closeTab", url: tabUrl, target: {id: initialTabs[i], title: tabTitle} };
					console.log(req);
					postRest(req);
					
					tabUrls.delete(initialTabs[i]);
					tabTitles.delete(initialTabs[i]);
					break;
				}
			}			
		}
		catch(err){
			console.log("Platform not supported");
		}
	});
}


function postRest(req) {
    var storage = (localStorage.getItem('checkboxValue') || {}) == 'true';
    if (storage === true) {
        // console.log("Recording Enabled")
        $.ajax({
            type: "POST",
            url: "http://127.0.0.1:8080",
            crossDomain: true,
            contentType: 'application/json',
			data: JSON.stringify(req),
			//data: req.toString().replace(/\n/g,"\\n").replace(/\r/g,"\\r").replace(/\t/g,"\\t"),
            success: function (responseData, status, xhr) {
                // console.log("Request Successful!" + responseData);
            },
            error: function (request, status, error) {
                console.log("Request Failed! " + JSON.stringify(request) + 'Status ' + status + "Error msg: " + error);
            }
        });
    } else {
        console.log("Recording Disabled");
    }
}

function navigation(evt) {
    var req = { timeStamp: new Date(Date.now()), targetApp: "Chrome", eventType: evt.transitionType, eventQual: JSON.stringify(evt.transitionQualifiers), url: evt.url };
    if (evt.transitionType != "auto_subframe") {
        if(req.eventType == "typed" || req.eventType == "auto_bookmark" || req.eventType == "generated" || req.eventQual.includes("forward_back")) {
            req.eventType = "navigate_to";			
        }
        if(!req.url.includes("newtab") && req.eventType != "link") {
            console.log(req);
            postRest(req);
        }
		chrome.tabs.query({'active': true, 'lastFocusedWindow': true }, function (tabs) {
			try{
				var tabUrl = tabs[0].url;
				var tabTitle = tabs[0].title;
				var tabId = tabs[0].id;
				tabTitles.set(tabId, tabTitle);
				tabUrls.set(tabId, tabUrl);
			}	
			catch(err){
				console.log("Platform not supported");
			}			
		});
    }
}

// function logOnBefore(details) {
//     var req = { timeStamp: new Date(Date.now()), eventType: "navigate_to", url: details.url };
//     //alert(req);
//     console.log(req);
//     postRest(req);
// }