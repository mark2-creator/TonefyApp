// Feeds utils/friendlyError.js the error strings real devices produce and checks each
// is classified right. Run after changing its patterns: node scripts/check-friendly-error.mjs
import fs from 'fs';
import os from 'os';
import path from 'path';
const src = fs.readFileSync('utils/friendlyError.js','utf8').replace(/^import \* as Sentry.*$/m, 'const Sentry={addBreadcrumb(){}};');
const tmp = path.join(os.tmpdir(), 'fe-' + process.pid + '.mjs'); fs.writeFileSync(tmp, src);
const { friendlyError, errorKind } = await import(tmp); fs.unlinkSync(tmp);
console.warn = () => {};
const cases = [
  ['Unable to resolve host "api.fitlifesolutions.site": No address associated with hostname','offline'],
  [Object.assign(new TypeError('Network request failed')),'offline'],
  [{code:'auth/network-request-failed', message:'Firebase: Error (auth/network-request-failed).'},'offline'],
  ['failed to connect to api.fitlifesolutions.site/185.1.2.3 (port 443)','offline'],
  ['java.net.SocketTimeoutException: timeout','timeout'],
  ['Request timed out after 60s','timeout'],
  [Object.assign(new Error('x'),{name:'AbortError'}),'timeout'],
  ["JSON Parse error: Unexpected token '<'",'server'],
  ['Server error (500). <html>','server'],
  ['ENOENT: no such file or directory, open \'/root/Tonefy-react/backend/tmp/a.mp4\'','unknown'],
  ["Cannot read properties of undefined (reading 'url')",'unknown'],
  ['Firebase: Error (auth/internal-error).','unknown'],
  ['DEVELOPER_ERROR','unknown'],
  ['That file is too large for the server to accept.','message'],
  ['You have used every credit this cycle. Upgrade to export more.','message'],
  ['Please add a caption before posting.','message'],
  ['The server is not responding right now. Try again in a moment.','message'],
];
let fail=0;
for (const [e,want] of cases){const k=errorKind(e); if(k!==want){fail++;console.log('FAIL',want,k,e);} }
console.log(friendlyError(cases[0][0],'Could not download the video.'));
console.log(fail ? fail + ' failed' : 'all ' + cases.length + ' passed'); process.exit(fail ? 1 : 0);
