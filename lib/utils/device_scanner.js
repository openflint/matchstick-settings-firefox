/*

 Copyright (C) 2013-2014, Infthink (Beijing) Technology Co., Ltd.

 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at

 http://www.apache.org/licenses/LICENSE-2.0

 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS-IS" BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License.

 */
const { Class } = require('sdk/core/heritage');
const { EventTarget } = require("sdk/event/target");
const { emit } = require("sdk/event/core");
const { SSDP } = require("./ssdp");
//const { Device } = require("./device");

/**
 * A class that (asynchronously) scans for available devices and sends corresponding notifications
 * to its listener(s). This class is implicitly a singleton; since it does a network scan, it isn't
 * useful to have more than one instance of it in use.
 *
 * @ingroup Discovery
 */

const EVENT_DEVICE_DID_COME_ONLINE = 'deviceDidComeOnline';
const EVENT_DEVICE_DID_GO_OFFLINE = 'deviceDidGoOffline';

const DeviceScanner = Class({
  extends: EventTarget,

  searchTarget: "urn:dial-multiscreen-org:service:dial:1",
  _devicesMap: new Map(),

  /**
   * Designated initializer. Constructs a new GCKDeviceScanner.
   */
  initialize: function initialize(device_finding_callback) {
    let self = this;
    self.ssdpClient = SSDP(device_finding_callback);

    self.ssdpClient.on(SSDP.EVENT_SERVICE_FOUND, function (location) {
      let service = self.ssdpClient.findServiceForLocation(location);
    });

    self.ssdpClient.on(SSDP.EVENT_SERVICE_LOST, function (location) {
      let service = self.ssdpClient.findServiceForLocation(location);
      let device = self._devicesMap.get(service.uuid);
      if (device) {
        emit(self, EVENT_DEVICE_DID_GO_OFFLINE, device);
      }
    });

    self.ssdpClient.registerTarget(this.searchTarget, function (aService, aApp) {
      return undefined; // ignore
    });
  },

  /**
   * Starts a new device scan. The scan must eventually be stopped by calling
   * @link #stopScan @endlink.
   */
  startScan: function startScan() {
    //let services = this.ssdpClient.services;
    //console.info("services::::::::::", services);
    this.ssdpClient.search();
  },

  /**
   * Stops any in-progress device scan. This method <b>must</b> be called at some point after
   * @link #startScan @endlink was called and before this object is released by its owner.
   */
  stopScan: function stopScan() {
      this.ssdpClient.stopSearch();
  }
});

DeviceScanner.EVENT_DEVICE_DID_COME_ONLINE = EVENT_DEVICE_DID_COME_ONLINE;
DeviceScanner.EVENT_DEVICE_DID_GO_OFFLINE = EVENT_DEVICE_DID_GO_OFFLINE;

exports.DeviceScanner = DeviceScanner;