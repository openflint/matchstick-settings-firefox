const { WifiScan } = require("./utils/wifi_scan");
const { DeviceScanner } = require("./utils/device_scanner");
const { Socket } = require("./utils/socket");
const { Cc, Ci, Cu } = require('chrome');
const { viewFor } = require("sdk/view/core");

var self = require("sdk/self"),
    system = require("sdk/system"),
    buttons = require('sdk/ui/button/action'),
    tabs = require("sdk/tabs"),
    tab_utils = require("sdk/tabs/utils"),
    tmr = require('sdk/timers'),
    data = require("sdk/self").data,

    doc = null,
    ff_version = system.version,
    dongle_ip = "192.168.1.1",
    dongle_port = 8881;

var button = buttons.ActionButton({
    id: "matchstick-settings",
    label: "Matchstick Settings",
    icon: {
        "16": "./icon-16.png",
        "32": "./icon-32.png",
        "64": "./icon-64.png"
    },
    onClick: handleClick
});

if (typeof String.prototype.startsWith != 'function') {
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

var pageWorker = null,
    ap_descs = [],
    apList = {}

    dScanner = null,
    wifiScan = null;

function apDiscover(){
    wifiScan = WifiScan(function(accessPoints, aLen){        
        let utf8Converter = Cc["@mozilla.org/intl/utf8converterservice;1"].getService(Ci.nsIUTF8ConverterService);
        let wifihtml = "",
            donglehtml = "";

        for(let i=0;i<accessPoints.length; i++){
            let name = utf8Converter.convertURISpecToUTF8 (accessPoints[i].ssid, "UTF-8");
            if(accessPoints[i].mac.startsWith("98-3b-16")||
                accessPoints[i].mac.startsWith("02-1a-11") ){
                pageWorker.port.emit("dongle_found", accessPoints[i], name);
                //todo here
                apList[accessPoints[i].mac] = accessPoints[i];
            }
        }
        pageWorker.port.emit("ap_list", apList);
    });
    wifiScan.startScan();
}


function deviceFinding(aService, rinfo){
    pageWorker.port.emit("dongle_available", aService);
}

function deviceDiscover(){
    dScanner.stopScan();
    dScanner.startScan();
}

function on_message(){
    pageWorker.port.on("page_init", function(){
        deviceDiscover();
    });
    let socket = null;

    function send_msg(msg){
        msg = msg.length+':'+msg;
        console.info("socket request msg: ", msg);
        socket.send(msg);
    }
    function get_resp_object(resp_data){
        resp_data = resp_data.substr(resp_data.indexOf(':')+1);
        var resp = JSON.parse(resp_data);
        return resp;
    }
    //dongle register
    pageWorker.port.on("dongle_reg", function(curr_dongle_info){
        try{
            socket = Socket();
            socket.conn(dongle_ip, dongle_port, function(resp_data){
                if(resp_data){
                    console.info("socket response : ", resp_data);
                    var resp = get_resp_object(resp_data);
                    if(resp.data.type=="ap-list" && resp.data.networks){
                        ap_descs = resp.data.networks;
                        pageWorker.port.emit("wifi_found_all", ap_descs);
                    }else if(resp.data.type=="key_code"){
                        pageWorker.port.emit("tv_code_ready", resp.data.key_code);
                    }
                }
            });
            curr_dongle_info = JSON.parse(curr_dongle_info);
            //dongle register
            let msg_register = '{"protocol_version":"1.0","message_type":"register","meta":{"reply":false,"connection_mode":"single"},"data":{"name":"wifi-setting"}}';
            send_msg(msg_register);

            //get ap list
            let msg_ap_list = '{"protocol_version":"1.0","message_type":"command","meta":{"reply":true},"data":{"command":"query","type":"ap-list"}}';
            send_msg(msg_ap_list);

            //get key code
            let dmac = curr_dongle_info.mac.replaceAll("-",":");
            let msg_keycode = '{"data":{"ap_mac":"'+dmac+'","command":"query","imei":"863985028265716","type":"key_code"},"message_type":"command","meta":{"reply":true},"protocol_version":"1.0"}';
            send_msg(msg_keycode);

            pageWorker.port.emit("dongle_reg_success");
        }catch(e){
            pageWorker.port.emit("dongle_reg_error", curr_dongle_info);
            console.info("dongle reg error: ", e);
        }
    });
    
    function setInfo(wifi_name, wifi_mac, wifi_pwd, dname, timezone, dip){
        socket = Socket();
        socket.conn(dip, dongle_port, function(resp_data){});
        let wifi_security = "WPA/WPA2 PSK";
        for (var i = ap_descs.length - 1; i >= 0; i--) {
            if(ap_descs[i].ssid==wifi_name){
                wifi_security = ap_descs[i].security;
                break;
            }
        };
        let msg_wifi_setting = '{"data":{"timezone":"'+timezone+'","wifi-hidden":false,"wifi-password":"'+wifi_pwd+'","name":"'+dname+'","command":"setting","wifi-type":"'+wifi_security+'","type":"wifi","wifi-name":"'+wifi_name+'","wifi-bssid":"'+wifi_mac+'"},"message_type":"command","meta":{"reply":true},"protocol_version":"1.0"}';
        send_msg(msg_wifi_setting);
        socket.close();
    }
    pageWorker.port.on("set_pwd", function(wifi_name, wifi_mac, wifi_pwd, dname, timezone){
        setInfo(wifi_name, wifi_mac, wifi_pwd, dname, timezone, dongle_ip);
    });
    pageWorker.port.on("reset", function(wifi_name, wifi_mac, wifi_pwd, dname, timezone, dip){
        setInfo(wifi_name, wifi_mac, wifi_pwd, dname, timezone, dip);
    });
    pageWorker.port.on("reboot", function(dip){
        socket = Socket();
        socket.conn(dip, dongle_port, function(resp_data){});
        let msg_wifi_setting = '{"data":{"command":"setting","type":"reboot_cast"},"message_type":"command","meta":{"reply":true},"protocol_version":"1.0"}';
        send_msg(msg_wifi_setting);
        socket.close();
    });

    pageWorker.port.on("dongle_reload", function(){
        deviceDiscover();
    });

    pageWorker.port.on("wifi_refresh", function(ip){
        if(ip==""){
            ip = dongle_ip;
        }
        socket = Socket();
        socket.conn(ip, dongle_port, function(resp_data){
            if(resp_data){
                var resp = get_resp_object(resp_data);
                if(resp.data.type=="ap-list" && resp.data.networks){
                    ap_descs = resp.data.networks;
                    pageWorker.port.emit("wifi_found_all", ap_descs);
                }
            }
        });
        let msg_ap_list = '{"protocol_version":"1.0","message_type":"command","meta":{"reply":true},"data":{"command":"query","type":"ap-list"}}';
        send_msg(msg_ap_list);
    });

    pageWorker.port.on("dongle_info", function(ip){
        socket = Socket();
        socket.conn(ip, dongle_port, function(resp_data){
            if(resp_data){
                var resp = get_resp_object(resp_data);
                console.info("--------------------------------------------->", resp_data);
                pageWorker.port.emit("dongle_info", resp);
            }
        });
        let msg = '{"protocol_version":"1.0","message_type":"command","meta":{"reply":true},"data":{"command":"query","type":"device_info"}}';
        send_msg(msg);

        let msg_ap_list = '{"protocol_version":"1.0","message_type":"command","meta":{"reply":true},"data":{"command":"query","type":"ap-list"}}';
        send_msg(msg_ap_list);
    });

    pageWorker.port.on("get_dongle_mac", function(ip){
        socket = Socket();
        socket.conn(ip, dongle_port, function(resp_data){
            if(resp_data){
                var resp = get_resp_object(resp_data);
                pageWorker.port.emit("get_dongle_mac_callback", ip, resp.data.macAddress);
            }
        });
        let msg = '{"protocol_version":"1.0","message_type":"command","meta":{"reply":true},"data":{"command":"query","type":"device_info"}}';
        send_msg(msg);
    });
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
            let worker = tab.attach({
                contentScriptFile: [
                    self.data.url("assets/js/jquery.min.js"), 
                    self.data.url("assets/js/timezones.js"),
                    self.data.url("assets/js/jstz.min.js"),
                    self.data.url("assets/js/lang.js"),
                    self.data.url("assets/js/all.js")]
            });
            pageWorker = worker;

            dScanner = DeviceScanner(deviceFinding);
            on_message();

            apDiscover();
            tmr.setInterval(function(){
                apDiscover();
            }, 10000);
        });
    }
}