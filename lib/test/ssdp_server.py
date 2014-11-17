#!/usr/bin/python
from socket import socket, inet_aton, IPPROTO_IP, IP_ADD_MEMBERSHIP
from socket import AF_INET, SOCK_DGRAM, SOL_SOCKET, SO_REUSEADDR, INADDR_ANY
from optparse import OptionParser
import struct

parser = OptionParser()
parser.add_option("-g", "--group", dest="group",
    default="239.255.255.250",
    help="IP Multicast Group (default: 239.255.255.250)")
parser.add_option("-p", "--port", dest="port", default=1900,
    help="IP Multicast UDP port number (default: 1900)")
parser.add_option("-b", "--buffer", dest="buffer", default=1500,
    help="IP Socket buffer size (default: 1500 bytes)")
options, args = parser.parse_args()

MCAST_GRP   = options.group
MCAST_PORT  = options.port
BUFFER_SIZE = options.buffer

sock = socket(AF_INET, SOCK_DGRAM)
sock.setsockopt(SOL_SOCKET, SO_REUSEADDR, 1)
mreq = struct.pack('=4sl', inet_aton(MCAST_GRP), INADDR_ANY) 
sock.setsockopt(IPPROTO_IP, IP_ADD_MEMBERSHIP, mreq)

sock.bind((MCAST_GRP, MCAST_PORT))

while True:
    data, srv_sock = sock.recvfrom(BUFFER_SIZE)
    srv_addr, srv_srcport = srv_sock[0], srv_sock[1]
    print "%s sent: %s" % (srv_addr, data)
