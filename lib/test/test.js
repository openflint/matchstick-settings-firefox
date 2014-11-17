function getPageContent(){
    var listener = {
        finished : function(data){
            console.info("Inizio dati letti\n"+data+"\nFine dati letti");
        }
    }
    readAllFromSocket("192.168.1.2", 9999, "Prova messaggio da Firefox",listener);
}

function readAllFromSocket(host, port, outputData, listener){
    try {
        var transportService = Cc["@mozilla.org/network/socket-transport-service;1"].getService(Ci.nsISocketTransportService);
        var transport = transportService.createTransport(null, 0, host, port, null);
        if(transport) {
            console.info("Creata la socket");
        } else {
            console.info("Errore creazione socket");
        }

        var outstream = transport.openOutputStream(0, 0, 0);
        outstream.write(outputData, outputData.length);
        console.info("Creato l'output stream e inviato il messaggio");

        var stream = transport.openInputStream(0, 0, 0);
        var instream = Cc["@mozilla.org/scriptableinputstream;1"].createInstance(Ci.nsIScriptableInputStream);
        instream.init(stream);
        console.info("Creato l'input stream");

        var dataListener = {
            data : "",
            onStartRequest: function(request, context){},
            onStopRequest: function(request, context, status) {
                instream.close();
                outstream.close();
                listener.finished(this.data);
            },
            onDataAvailable: function(request, context, inputStream, offset, count){
                this.data += instream.read(count);
                console.info("Ho aggiunto dati al buffer");
            }
        };

        var pump = Cc["@mozilla.org/network/input-stream-pump;1"].createInstance(Ci.nsIInputStreamPump);
        pump.init(stream, -1, -1, 0, 0, false);
        while(true){
            pump.asyncRead(dataListener, null);
        }
    } catch (ex){
        throw ex;
    }
    return null;
}




let stream = transport.openInputStream(0,0,0);
let instream =
Cc["@mozilla.org/scriptableinputstream;1"].createInstance(Ci.nsIScriptableInputStream);
instream.init(stream);

let outstream = transport.openOutputStream(0,0,0);
outstream.write(transprop,transprop.length);
outstream.close(); 