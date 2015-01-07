// -*- Mode: js2; tab-width: 2; indent-tabs-mode: nil; js2-basic-offset: 2; js2-skip-preprocessor-directives: t; -*-
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

"use strict";

const { Class } = require('sdk/core/heritage');
const { EventTarget } = require("sdk/event/target");
const { emit } = require("sdk/event/core");
const { Cc, Ci, Cu } = require('chrome');

Cu.import("resource://gre/modules/Services.jsm");
Cu.import("resource://gre/modules/XPCOMUtils.jsm");

XPCOMUtils.defineLazyGetter(this, "converter", function () {
    let conv = Cc["@mozilla.org/intl/scriptableunicodeconverter"].createInstance(Ci.nsIScriptableUnicodeConverter);
    conv.charset = "utf8";
    return conv;
});

// Spec information:
// https://tools.ietf.org/html/draft-cai-ssdp-v1-03
// http://www.dial-multiscreen.org/dial-protocol-specification
const SSDP_PORT = 1900;
const SSDP_ADDRESS = "239.255.255.250";

const SSDP_DISCOVER_PACKET =
    "M-SEARCH * HTTP/1.1\r\n" +
    "HOST: " + SSDP_ADDRESS + ":" + SSDP_PORT + "\r\n" +
    "MAN: \"ssdp:discover\"\r\n" +
    "MX: 2\r\n" +
"ST: %SEARCH_TARGET%\r\n\r\n";

const SSDP_DISCOVER_TIMEOUT = 10000;
const EVENT_SERVICE_FOUND = "ssdp-service-found";
const EVENT_SERVICE_LOST = "ssdp-service-lost";

/*
 * SimpleServiceDiscovery manages any discovered SSDP services. It uses a UDP
 * broadcast to locate available services on the local network.
 */


const SSDP = Class({
    extends: EventTarget,

    _targets: new Map(),
    _services: new Map(),
    _searchSocket: null,
    _searchInterval: 0,
    _searchTimestamp: 0,
    _searchTimeout: Cc["@mozilla.org/timer;1"].createInstance(Ci.nsITimer),
    _searchRepeat: Cc["@mozilla.org/timer;1"].createInstance(Ci.nsITimer),

    initialize: function (device_finding_callback) {
        this.device_finding_callback=device_finding_callback;
    },

    _forceTrailingSlash: function (aURL) {
        // Cleanup the URL to make it consistent across devices
        try {
            aURL = Services.io.newURI(aURL, null, null).spec;
        } catch (e) {
            console.info(e);
        }
        return aURL;
    },

    // nsIUDPSocketListener implementation
    onPacketReceived: function (aSocket, aMessage) {
        // Listen for responses from specific targets. There could be more than one available.
        let response = aMessage.data.split("\n"),
            location,
            target,
            valid = false;
        response.some(function (row) {
            let header = row.toUpperCase();
            if (header.startsWith("LOCATION")) {
                location = row.substr(10).trim();
            } else if (header.startsWith("ST")) {
                target = row.substr(4).trim();
                if (this._targets.has(target)) {
                    valid = true;
                }
            }

            if (location && valid) {
                location = this._forceTrailingSlash(location);

                // When we find a valid response, package up the service information
                // and pass it on.
                let service = {
                    location: location,
                    target: target
                };
                try {
                    this._processService(service, aMessage.fromAddr);
                } catch (e) {
                }
                return true;
            }
            return false;
        }.bind(this));
    },

    onStopListening: function (aSocket, aStatus) {
        // This is fired when the socket is closed expectedly or unexpectedly.
        // nsITimer.cancel() is a no-op if the timer is not active.
        this._searchTimeout.cancel();
        this._searchSocket = null;
    },

    // Start a search. Make it continuous by passing an interval (in milliseconds).
    // This will stop a current search loop because the timer resets itself.
    // Returns the existing search interval.
    search: function search(aInterval) {
        let existingSearchInterval = this._searchInterval;
        if (aInterval > 0) {
            this._searchInterval = aInterval || 0;
            this._searchRepeat.initWithCallback(this._search.bind(this), this._searchInterval, Ci.nsITimer.TYPE_REPEATING_SLACK);
        }
        this._search();
        return existingSearchInterval;
    },

    // Stop the current continuous search
    stopSearch: function stopSearch() {
        this._searchRepeat.cancel();
    },

    _usingLAN: function () {
        return true;
    },

    _search: function _search() {
        // If a search is already active, shut it down.
        this._searchShutdown();

        // We only search if on local network
        if (!this._usingLAN()) {
            return;
        }

        // Update the timestamp so we can use it to clean out stale services the
        // next time we search.
        this._searchTimestamp = Date.now();

        // Look for any fixed IP targets. Some routers might be configured to block
        // UDP broadcasts, so this is a way to skip discovery.
        this._searchFixedTargets();

        // Perform a UDP broadcast to search for SSDP devices
        this._searchSocket = Cc["@mozilla.org/network/udp-socket;1"].createInstance(Ci.nsIUDPSocket);
        try {
          this._searchSocket.init(-1, false);
          this._searchSocket.asyncListen(this);
        } catch (e) {
            // We were unable to create the broadcast socket. Just return, but don't
            // kill the interval timer. This might work next time.
            console.log("failed to start socket: " + e);
            return;
        }

        this._searchTimeout.initWithCallback(this._searchShutdown.bind(this), SSDP_DISCOVER_TIMEOUT, Ci.nsITimer.TYPE_ONE_SHOT);

        let data = SSDP_DISCOVER_PACKET;
        for (let [key, target] of this._targets) {
            let msgData = data.replace("%SEARCH_TARGET%", target.target);
            try {
                let msgRaw = converter.convertToByteArray(msgData);
                this._searchSocket.send(SSDP_ADDRESS, SSDP_PORT, msgRaw, msgRaw.length);
            } catch (e) {
                console.log("failed to convert to byte array: " + e);
            }
        }
    },

    _searchFixedTargets: function _searchFixedTargets() {
        let fixedTargets = null;
        try {
            fixedTargets = Services.prefs.getCharPref("browser.casting.fixedTargets");
        } catch (e) {
            console.log(e);
        }
        if (!fixedTargets) {
            return;
        }

        fixedTargets = JSON.parse(fixedTargets);
        for (let fixedTarget of fixedTargets) {
            // Verify we have the right data
            if (!"location" in fixedTarget || !"target" in fixedTarget) {
                continue;
            }

            fixedTarget.location = this._forceTrailingSlash(fixedTarget.location);

            let service = {
                location: fixedTarget.location,
                target: fixedTarget.target
            };

            // We don't assume the fixed target is ready. We still need to ping it.
            try {
                console.info('_searchFixedTargets:');
                this._processService(service);
            } catch (e) {
                console.log(e);
            }
        }
    },

    // Called when the search timeout is hit. We use it to cleanup the socket and
    // perform some post-processing on the services list.
    _searchShutdown: function _searchShutdown() {
        if (this._searchSocket) {
            // This will call onStopListening.
            this._searchSocket.close();

            // Clean out any stale services
            for (let [key, service] of this._services) {
                if (service.lastPing != this._searchTimestamp) {
                    emit(this, EVENT_SERVICE_LOST, service.location);
                    this._services.delete(service.location);
                }
            }
        }
    },

    registerTarget: function registerTarget(aTarget, aAppFactory) {
        // Only add if we don't already know about this target
        if (!this._targets.has(aTarget)) {
            this._targets.set(aTarget, { target: aTarget, factory: aAppFactory });
        }
    },

    findAppForService: function findAppForService(aService) {
        if (!aService || !aService.target) {
            return null;
        }
        // Find the registration for the target
        if (this._targets.has(aService.target)) {
            return this._targets.get(aService.target).factory(aService);
        }
        return null;
    },

    findServiceForLocation: function findServiceForLocation(aLocation) {
        if (this._services.has(aLocation)) {
            return this._services.get(aLocation);
        }
        return null;
    },

    // Returns an array copy of the active services
    get services() {
        let array = [];
        for (let [key, service] of this._services) {
            array.push(service);
        }
        return array;
    },

    _processService: function _processService(aService, rinfo) {
        let xhr = Cc["@mozilla.org/xmlextras/xmlhttprequest;1"].createInstance(Ci.nsIXMLHttpRequest);

        xhr.open("GET", aService.location, true);
        xhr.channel.loadFlags |= Ci.nsIRequest.INHIBIT_CACHING;
        xhr.overrideMimeType("text/xml");

        xhr.addEventListener("load", (function () {
            if (xhr.status == 200) {
                let doc = xhr.responseXML;
                try {
                    aService.ipAddress = rinfo.address;
                    aService.appsURL = xhr.getResponseHeader("Application-URL");

                    if (aService.appsURL && !aService.appsURL.endsWith("/")) {
                        aService.appsURL += "/";
                    }
                    aService.friendlyName = doc.querySelector("root > device > friendlyName").textContent;
                    aService.uuid = doc.querySelector("root > device > UDN").textContent;
                    aService.manufacturer = doc.querySelector("root > device > manufacturer").textContent;
                    aService.modelName = doc.querySelector("root > device > modelName").textContent;

                    // Only add if we don't already know about this service
                    if (!this._services.has(aService.location)) {
                        this._services.set(aService.location, aService);
                    }
                    emit(this, EVENT_SERVICE_FOUND, aService.location);
                    // Services.obs.notifyObservers(null, EVENT_SERVICE_FOUND, aService.location);
                    this.device_finding_callback(aService, rinfo);
                    // Make sure we remember this service is not stale
                    this._services.get(aService.location).lastPing = this._searchTimestamp;
                } catch (ex) {
                    console.error(ex);
                }
            }
        }).bind(this), false);
        xhr.send(null);
    }
});

SSDP.EVENT_SERVICE_FOUND = EVENT_SERVICE_FOUND;
SSDP.EVENT_SERVICE_LOST = EVENT_SERVICE_LOST;

exports.SSDP = SSDP;
