#!/usr/bin/python
# -*- coding: utf-8 -*-
from socket import *

HOST = '192.168.8.178'
PORT = 8011
BUFSIZ = 1024
ADDR = (HOST, PORT)

tcpCliSock = socket(AF_INET, SOCK_STREAM)
tcpCliSock.connect(ADDR)

while True:
    data = raw_input('> ')
    if not data:
        break
    tcpCliSock.send(data)
    data1 = tcpCliSock.recv(BUFSIZ)
    if not data1:
        break
    print data1

tcpCliSock.close()