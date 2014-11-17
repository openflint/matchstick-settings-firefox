const { Class } = require('sdk/core/heritage');
const { Cc, Ci, Cu } = require('chrome');

const Socket = Class({
    conn: function conn(host, port, readCallback){
        let transportService = Cc["@mozilla.org/network/socket-transport-service;1"].getService(Ci.nsISocketTransportService);
        let transport = this.transport = transportService.createTransport(null, 0, host, port, null);
        
        let outstream = this.outstream = transport.openOutputStream(0, 0, 0);
        let input = this.input = transport.openInputStream(0, 0, 0);
        let instream = this.instream = Cc["@mozilla.org/scriptableinputstream;1"].createInstance(Ci.nsIScriptableInputStream);
        this.instream.init(input);

        var pump = Cc["@mozilla.org/network/input-stream-pump;1"].createInstance(Ci.nsIInputStreamPump);
        pump.init(input, -1, -1, 0, 0, false);

        var dataListener = {
            data : "",
            onStartRequest: function(request, context){},
            onStopRequest: function(request, context, status) {
                instream.close();
                input.close();
                outstream.close();
            },
            onDataAvailable: function(request, context, inputStream, offset, count){
                try{
                    this.resp_data = instream.read(count);
                    readCallback(this.resp_data);
                }catch(e){
                    console.info("on data error", e);
                }
            }
        };
        pump.asyncRead(dataListener, null);
    },
    send: function send(data){
        this.outstream.write(data, data.length);
    },
    close: function close(){
        this.instream.close();
        this.input.close();
        this.outstream.close();
    }
});

exports.Socket = Socket;