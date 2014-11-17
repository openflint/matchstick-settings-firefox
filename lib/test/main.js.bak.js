const { WifiScan } = require("./utils/wifi_scan");
const { Socket } = require("./utils/socket");
const { Cc, Ci, Cu } = require('chrome');
const { viewFor } = require("sdk/view/core");

var system = require("sdk/system");
var data = require("sdk/self").data;
var buttons = require('sdk/ui/button/action');
var tabs = require("sdk/tabs");
var tab_utils = require("sdk/tabs/utils");

//get firefox version
console.info(system.version);
var button = buttons.ActionButton({
  id: "mozilla-link",
  label: "Visit Mozilla",
  icon: {
    "16": "./icon-16.png",
    "32": "./icon-32.png",
    "64": "./icon-64.png"
  },
  onClick: handleClick
});

if (typeof String.prototype.startsWith != 'function') {
  // see below for better implementation!
  String.prototype.startsWith = function (str){
    return this.indexOf(str) == 0;
  };
}
if (typeof String.prototype.replaceAll != 'function') {
    String.prototype.replaceAll = function (AFindText,ARepText){
        raRegExp = new RegExp(AFindText,"g");
        return this.replace(raRegExp,ARepText);
    }
}
function devices_discover(){

}

/*
* discover wifi
**/
var wifi_list = {},
    dongle_list = {};
function wifi_discover(doc){
    wifiScan = WifiScan(function(accessPoints, aLen){
        let utf8Converter = Cc["@mozilla.org/intl/utf8converterservice;1"].getService(Ci.nsIUTF8ConverterService);
        let wifihtml = ""
            donglehtml = "";
        for(let i=0;i<accessPoints.length; i++){
            let name = utf8Converter.convertURISpecToUTF8 (accessPoints[i].ssid, "UTF-8"),
                item = '<option id="wifi-'+accessPoints[i].mac+'" value="'+name+'" data-mac="'+accessPoints[i].mac+'">'+name+'</option>';
            if(accessPoints[i].mac.startsWith("98-3b-16")||
                accessPoints[i].mac.startsWith("02-1a-11")){
                donglehtml += item;
                dongle_list[name] = accessPoints[i];
            }else{
                wifihtml += item;
                wifi_list[name] = accessPoints[i];
            }
        }
        let dom_wifi = doc.getElementById("wifi"),
            dom_dongle = doc.getElementById("dongle");
        dom_wifi.innerHTML = '<option value="">请选择</option>'+wifihtml;
        dom_dongle.innerHTML = '<option value="">请选择</option>'+donglehtml;
    });
    wifiScan.startScan();
}

function device_discover(doc){
    let deviceScanner = DeviceScanner();
    deviceScanner.startScan();
}

function handleClick(state) {
    let is_config_page = null;
    for each (var tab in tabs){
        is_config_page = tab.url.match(/resource\:\/\/([\s\S]+?)\/wifi\-setting\/data\/home\.html/);
        if(is_config_page!=null){
            break;
        }
    }
    if(is_config_page==null){
        tabs.open(data.url("home.html"));
        tabs.on("ready",function(tab){
            let lowLevelTab = viewFor(tab),
                browser = tab_utils.getBrowserForTab(lowLevelTab),
                doc = browser.contentDocument;

            wifi_discover(doc);
            //device_discover(doc);
            doc.getElementById("wifi").onchange = function(e){

            };
            doc.getElementById("dongle").onchange = function(e){
                if(this.value){
                    doc.getElementById("dongle_w").innerHTML = this.value;
                }
            };
            doc.getElementById("setting-btn").onclick = function(e){                
                let ip = "192.168.1.1",
                    port = 8881,

                    dname = doc.getElementById("dongle").value,
                    dname2 = doc.getElementById("name").value,
                    wname = doc.getElementById("wifi").value,
                    wpwd  = doc.getElementById("pwd").value,
                    timezone = doc.getElementById("timezone").value,

                    wifi_security = 'WPA/WPA2 PSK',

                    socket = Socket();

                //socket callback
                socket.conn(ip, port, function(resp_data){
                    resp_data = resp_data.substr(resp_data.indexOf(':')+1);
                    console.info("socket response : ", resp_data);
                    doc.getElementById("status").innerHTML = "dongle response: "+resp_data;
                    var resp = JSON.parse(resp_data);
                    if(resp.data.type=="key_code"){
                        console.info("key code in screen : ", resp.data.key_code);

                        let wmac = wifi_list[wname]['mac'].replaceAll("-",":");
                        let msg_wifi_setting = '{"data":{"timezone":"'+timezone+'","wifi-hidden":false,"wifi-password":"'+wpwd+'","name":"'+dname2+'","command":"setting","wifi-type":"'+wifi_security+'","type":"wifi","wifi-name":"'+wname+'","wifi-bssid":"'+wmac+'"},"message_type":"command","meta":{"reply":false},"protocol_version":"1.0"}';
                        msg_wifi_setting = msg_wifi_setting.length+":"+msg_wifi_setting;
                        socket.send(msg_wifi_setting);
                        console.info("socket request msg_wifi_setting : ", msg_wifi_setting);
                    }else if(resp.data.type=="ap-list"){
                        resp.data.networks;
                        if(resp.data.networks){
                            for (var i = resp.data.networks.length - 1; i >= 0; i--) {
                                if(resp.data.networks[i].ssid==wname){
                                    wifi_security = resp.data.networks[i].security;
                                    break;
                                }
                            };
                        }
                    }
                });
                
                //dongle register
                let msg_register = '{"protocol_version":"1.0","message_type":"register","meta":{"reply":false,"connection_mode":"single"},"data":{"name":"wifi-setting"}}';
                msg_register = msg_register.length+':'+msg_register;
                socket.send(msg_register);
                console.info("socket request msg_register : ", msg_register);
                doc.getElementById("status").innerHTML = "register: "+msg_register;

                //get wifi information
                let msg_ap_list = '{"protocol_version":"1.0","message_type":"command","meta":{"reply":true},"data":{"command":"query","type":"ap-list"}}';
                msg_ap_list = msg_ap_list.length+":"+msg_ap_list;
                socket.send(msg_ap_list);
                console.info("socket request msg_ap_list : ", msg_ap_list);
                doc.getElementById("status").innerHTML = "get ap list: "+msg_ap_list;
                
                //get key code
                let dmac = dongle_list[dname]['mac'].replaceAll("-",":");
                let msg_keycode = '{"data":{"ap_mac":"'+dmac+'","command":"query","imei":"863985028265716","type":"key_code"},"message_type":"command","meta":{"reply":true},"protocol_version":"1.0"}';
                msg_keycode = msg_keycode.length+":"+msg_keycode;
                socket.send(msg_keycode);
                console.info("socket request msg_keycode : ", msg_keycode);
                doc.getElementById("status").innerHTML = "get keycode: "+msg_keycode;
            };
        });
    }
}