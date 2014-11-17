import socket
def _encode_len(n):
    r = ''
    if n >= 268435456:
        r = r + chr(((n >> 28) & 0x7f) | 0x80)
        pass
    if n >= 2097152:
        r = r + chr(((n >> 21) & 0x7f)| 0x80)
        pass
    if n >= 16384:
        r = r + chr(((n >> 14) & 0x7f)| 0x80)
        pass
    if n >= 128:
        r = r + chr(((n >> 7) & 0x7f)| 0x80)
        pass
    r = r + chr(n & 0x7f)
    return r

def _decode_len(s):
    n = 0
    for c in s:
        n = (n << 7) | (ord(c) & 0x7f)
        if not (ord(c) & 0x80):
            break
        pass
    return n

def _encode_str(s):
    n = len(s)
    r = _encode_len(n) + s
    return r

def _decode_str(s):
    n = _decode_len(s)
    skip = len(_encode_len(n))
    r = s[skip: skip + n]
    
    return r, skip + n

def query_service(sock, st):
    q = chr(1) + _encode_str(st)
    sock.send(q)

    rep = sock.recv(10240)

    n = _decode_len(rep)
    skip = len(_encode_len(n))
    
    result = []
    remain = rep[skip:]
    for i in range(n):
        location, skip = _decode_str(remain)
        remain = remain[skip:]
        
        r_st, skip = _decode_str(remain)
        remain = remain[skip:]
        
        r_usn, skip = _decode_str(remain)
        remain = remain[skip:]
        
        result.append((location, r_st, r_usn))
        pass

    return result

sock = socket.socket(socket.AF_UNIX, socket.SOCK_STREAM, 0)
sock.connect('/var/run/minissdpd.sock')
r = query_service(sock,
    'urn:schemas-wifialliance-org:service:WFAWLANConfig:1')
print r