const { Class } = require('sdk/core/heritage');
const { Cc, Ci, Cu } = require('chrome');

const WifiScan = Class({
    initialize: function initialize(callback) {
        this.wifiMonitor = Cc["@mozilla.org/wifi/monitor;1"].getService(Ci.nsIWifiMonitor);
        this.wifiListener = {
            onChange: function(accessPoints, aLen){
                callback(accessPoints, aLen);
            }
        };
    },
    startScan: function startScan(){
        this.wifiMonitor.startWatching(this.wifiListener);
    },
    stopScan: function stopScan(){
        this.wifiMonitor.stopWatching(this.wifiListener);
    }
});

exports.WifiScan = WifiScan;