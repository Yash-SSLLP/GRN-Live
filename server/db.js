const mongoose = require('mongoose');
const dns = require('dns');

async function connect(uri) {
  const target = uri || process.env.MONGODB_URI || 'mongodb://localhost:27017/grn';
  // A `mongodb+srv://` URI needs a DNS SRV lookup. Some networks' resolver
  // refuses SRV queries (Node throws `querySrv ECONNREFUSED`), so for SRV URIs
  // we point Node's resolver at public DNS. Override the servers with
  // DNS_SERVERS (comma-separated) or disable this entirely with DNS_SERVERS=off.
  if (target.startsWith('mongodb+srv://') && process.env.DNS_SERVERS !== 'off') {
    const servers = (process.env.DNS_SERVERS || '8.8.8.8,1.1.1.1')
      .split(',').map((s) => s.trim()).filter(Boolean);
    if (servers.length) { try { dns.setServers(servers); } catch (e) { /* ignore */ } }
  }
  mongoose.set('strictQuery', true);
  // Guarantee a database name. A URI like `…mongodb.net/?appName=…` (no name in
  // the path) silently connects to `test`, so local and prod can end up reading
  // different databases from the same cluster. When the path is empty, force the
  // app's db (override via MONGODB_DB) so every environment lands on the same one.
  const opts = {};
  try {
    const p = (new URL(target).pathname || '').replace(/^\//, '');
    if (!p) opts.dbName = process.env.MONGODB_DB || 'grn';
  } catch (e) { /* non-URL target — let mongoose handle it */ }
  await mongoose.connect(target, opts);
  console.log(`✓ MongoDB connected → db "${mongoose.connection.name}"`);
}

module.exports = { connect, mongoose };
