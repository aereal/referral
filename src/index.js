const http      = require('http');
const httpProxy = require('http-proxy');
const formatURL = require('url').format;
const parseURL  = require('url').parse;

import { control } from './control';
import { ClientError } from './clientError';
import { drawRoute } from './drawRoute';

function createReferer(url) {
  const { protocol, hostname, port } = parseURL(url);
  return formatURL({
    protocol,
    hostname,
    port,
    pathname: '/',
  })
}
exports.createReferer = createReferer;

function extractForwardURL(url) {
  if (!url) throw new Error('url must be given');
  const { query: { url: forwardURL } } = parseURL(url, true);
  const { href, hostname, protocol } = parseURL(forwardURL);
  if ((hostname || '') === '' || (protocol || '') === '') throw new Error('Invalid url');
  return href;
}
exports.extractForwardURL = extractForwardURL;

function rewriteHeaders(proxyReq, req) {
  const forwardURL = extractForwardURL(req.url);
  const referer    = createReferer(forwardURL);
  const forwarded  = parseURL(forwardURL);

  proxyReq.path = req.path = forwarded.pathname;
  proxyReq.setHeader('Host', forwarded.hostname);
  proxyReq.setHeader('Referer', referer);
}
exports.rewriteHeaders = rewriteHeaders;

const proxy = httpProxy.createProxyServer({});
proxy.on('proxyReq', rewriteHeaders);
http.createServer((req, res) => {
  drawRoute(req, res)
    .then(([req, res]) => {
      return control(extractForwardURL.bind(this, req.url))
        .then(forwardURL => {
          console.log(`---> forwardURL = ${forwardURL}`);
          const target = createReferer(forwardURL);
          proxy.web(req, res, { target: target });
        }, err => {
          throw new ClientError("Valid url parameter required", 400);
        })
    })
    .catch(err => {
      const httpError = err instanceof ClientError ? err : new ClientError('something bad', 500);
      res.writeHead(httpError.statusCode, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.write(httpError.message + "\n");
      res.end()
    })
}).listen(9090);
