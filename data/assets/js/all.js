if (typeof String.prototype.startsWith != 'function') {
  String.prototype.startsWith = function (str){
    return this.indexOf(str) == 0;
  };
}
if (typeof String.prototype.replaceAll != 'function') {
    String.prototype.replaceAll = function (AFindText,ARepText){
        raRegExp = new RegExp(AFindText,"g");
        return this.replace(raRegExp,ARepText);
    };
}

function click_callback(to){
    if("dongle-list"==to){
        self.port.emit("dongle_reload");
    }else if("set-name"==to){
        var h = document.body.scrollHeight>window.innerHeight?document.body.scrollHeight:window.innerHeight;
        $("#maskback").height(h);
        $("#maskback").show();
        $("#maskmain").show();

        var l = ((window.innerWidth/2)-($("#maskmain").width()/2)),
            t = (h/2)-($("#maskmain").height()/2);
        $("#maskmain").css({left:l+"px", top: t+"px"});

        $("#maskmain .data").unbind("click").bind("click", function(e){
            e.preventDefault();
            return false;
        });
        $("#maskmain .close").unbind("click").bind("click", function(){
            $("#maskback").hide();
            $("#maskmain").hide();
        });
        $("#maskback").unbind("click").bind("click", function(){
            $("#maskback").hide();
            $("#maskmain").hide();
        });
    }
}

self.port.on("dongle_found", function(aService, name) {
    var temp = $("#temp-un-dlist").html();
    temp = temp.replaceAll("##name##", name).replaceAll("##mac##", aService.mac);

    var ditems = $("#dongle-unlist .dunsetitem"),
        flag = false;
    if(ditems.length>=1){
        for (var i = ditems.length - 1; i >= 0; i--) {
            if($(ditems[i]).attr("data-mac")==aService.mac){
                flag = true;
                break;
            }
        };
        if(!flag){
            $("#dongle-unlist").append(temp);
        }
    }else{
        $("#dongle-unlist").append(temp);
    }

    $(".dunsetitem").unbind("click").bind("click", function(e){
        $(".main").hide();
        var name = $(this).attr("data-name"),
            mac = $(this).attr("data-mac"),
            json = '';
        $(".curr_dname").text(name);
        $("#set-name").show();
        json = '{"name":"'+name+'", "mac":"'+mac+'"}';
        $("#curr-unset-dongle").val(json);
        $("#dongle-name").attr("oname", name);
        click_callback("set-name");
    });
});

self.port.on("ap_list",function(apList){
    if(apList){
        $("#dongle-unlist .ditem").each(function(e){
            if( typeof(apList[$(this).attr("data-mac")])=="undefined" ){
                $(this).remove();
            }
        });
    }
})

function insertWifiOptions(mac, name){
    var temp = '<option id="wifi-'+mac+'" value="'+name+'" data-mac="'+mac+'">'+name+'</option>';
    $("#wifi").append(temp);
    $("#wifi-join").append(temp);
}
self.port.on("wifi_found", function(aService, name) {
    insertWifiOptions(aService.mac, name);
});
self.port.on("wifi_found_all", function(wifiList){
    $("#wifi").html("");
    $("#wifi-join").html("");
    for(var i=0;i<wifiList.length;i++){
        if(wifiList[i].bssid.startsWith("98:3b:16")||
            wifiList[i].bssid.startsWith("02:1a:11") ){
        }else{
            insertWifiOptions(wifiList[i].bssid, wifiList[i].ssid);
        }
    }
});
self.port.on("dongle_available", function(aService){
    var temp = $("#temp-r-dlist").html();
    temp = temp.replaceAll("##name##", aService.friendlyName).replaceAll("##ip##", aService.ipAddress).replaceAll("##mac##","")

    var ditems = $("#dongle-rlist .ditem"),
        flag = false;
    if(ditems.length>=1){
        for (var i = ditems.length - 1; i >= 0; i--) {
            if($(ditems[i]).attr("data-ip") == aService.ipAddress){
                flag = true;
                break;
            }
        }
        if(!flag){
            $("#dongle-rlist").append(temp);
        }
    }else{
        $("#dongle-rlist").append(temp);
    }
    $("#dongle-rlist .ditem").unbind("click").bind("click", function(e){
        $("#detail input[name='dongle-name']").val($(this).attr("data-name"));
        $("#detail #dongle-ip").text($(this).attr("data-ip"));
        $(".main").hide();
        $("#detail").show();
        $("#wifi-refresh-ip").attr("ip", $(this).attr("data-ip"));

        self.port.emit("wifi_refresh", $(this).attr("data-ip"));
        self.port.emit("dongle_info", $(this).attr("data-ip"));
    });
    self.port.emit("get_dongle_mac", aService.ipAddress);
});
self.port.on("get_dongle_mac_callback", function(ip, mac){
    $("#dongle-rlist .ditem").each(function(){
        $(this).attr("data-ip");
    });
    mac = mac.replaceAll(":", "-");
    $("#dongle-unlist .ditem").each(function(e){
        console.info("-------------------------->", $(this).attr("data-mac"), mac);
        if($(this).attr("data-mac")==mac){
            $(this).remove();
        }
    });
});

self.port.on("tv_code_ready", function(code){
    $("#tv-code").text(code);
});

self.port.on("dongle_info", function(resp){
    $("#dongle-mac").text(resp.data.macAddress);
    $("#dongle-ver").text(resp.data.version);
    $("#lang option[value='"+resp.data.language+"']").attr("selected", true);
    $("#loc option[value='"+resp.data.timezone+"']").attr("selected", true);
});

$(document).ready(function(){
    var tz = jstz.determine().name();
    var lang = navigator.language || navigator.userLanguage;

    self.port.emit("page_init");
    var tms = '';
    for (var i=timezones.length-1; i>=0; i--) {
        if(tz==timezones[i]){
            tms += '<option value="'+timezones[i]+'" selected>'+timezones[i]+'</option>';
        }else{
            tms += '<option value="'+timezones[i]+'">'+timezones[i]+'</option>';
        }
    }
    $("#loc").append(tms);

    $(".goback").click(function(){
        $(".main").hide();
        var to = $(this).attr("to");
        $("#"+to).show();
        click_callback(to);
    });
    $(".btn-to").unbind("click").bind("click", function(){
        $(".main").hide();
        var to = $(this).attr("to");
        $("#"+to).show();
        if(to=='set-wifi'){
            $("#set-wifi .alert-success").hide();
            $("#btn-set-wifi").removeClass("btn-cancel");
        }
        click_callback(to);
    });

    $("#btn-set-name").click(function(){
        self.port.emit("dongle_reg", $("#curr-unset-dongle").val());
    });
    self.port.on("dongle_reg_success", function(){
        if(typeof(window.dongle_reg_error_timer)!="undefined"){
            clearTimeout(window.dongle_reg_error_timer);
        }
    });
    self.port.on("dongle_reg_error", function(dongle_info){
        window.dongle_reg_error_timer = setTimeout(function(){
            console.info("--------------error----------", dongle_info);
            self.port.emit("dongle_reg", dongle_info);
        }, 2000);
    });

    $("#btn-set-wifi").click(function(){
        if(!$(this).hasClass("btn-cancel")){
            var wifi_name = $("#wifi-join").val(),
                wifi_mac = $("#wifi-join option:selected").attr("data-mac"),
                wifi_pwd = $("#wifi-password").val(),
                timezone = $("#loc").val();
            var dname = $("#dongle-name").val();
            if(!dname){
                dname = $("#dongle-name").attr("oname");
            }
            self.port.emit("set_pwd", wifi_name, wifi_mac, wifi_pwd, dname, timezone);
            $("#btn-set-wifi").addClass("btn-cancel");
            $("#set-wifi .alert-success").show();
        }
    });
    $(".btn-wifi-refresh").click(function(){
        self.port.emit("wifi_refresh", $(this).attr("ip"));
    });

    $("#btn-reset").click(function(){
        var dname = $("#reset-dongle-name").val(),
            wifi_name = $("#wifi").val(),
            wifi_mac = $("#wifi option:selected").attr("data-mac"),
            wifi_pwd = $("#reset-wifi-password").val(),
            timezone = $("#loc").val(),
            lang = $("#lang").val(),
            pix = $("#pix").val(),
            dip = $("#dongle-ip").text();
        self.port.emit("reset", wifi_name, wifi_mac, wifi_pwd, dname, timezone, dip);
    });
    $("#btn-reboot").click(function(){
        self.port.emit("reboot", $("#dongle-ip").text());
    });
});
