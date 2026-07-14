require('dotenv').config();
const readline = require('readline');
const bcrypt = require('bcryptjs');
const { connect, mongoose } = require('./db');
const User = require('./models/User');
const Vendor = require('./models/Vendor');
const Product = require('./models/Product');
const { norm } = require('./helpers');

const MIN_PASSWORD = 8;

// Ask a question on the terminal. When `hidden`, the typed characters are not
// echoed (used for the password) via readline's output hook.
function ask(query, hidden = false) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
  if (hidden) {
    let shownPrompt = false;
    rl._writeToOutput = () => { if (!shownPrompt) { process.stdout.write(query); shownPrompt = true; } };
  }
  return new Promise((resolve) => rl.question(query, (ans) => { rl.close(); if (hidden) process.stdout.write('\n'); resolve(ans.trim()); }));
}

// The first admin's credentials come from CLI args or an interactive prompt —
// NEVER from env, so no plaintext password lives in a file. They are written to
// MongoDB (hashed); after that, login authenticates only against the DB.
//   node server/seed.js <username> <password>   # explicit (works in CI / one-off jobs)
//   node server/seed.js                         # prompts for both (password masked)
async function getAdminCreds() {
  const args = process.argv.slice(2).filter((a) => !a.startsWith('-'));
  let username = (args[0] || '').trim();
  let password = args[1] || '';
  const tty = process.stdin.isTTY;

  if (!username) {
    if (!tty) return { error: 'Admin username required. Run: node server/seed.js <username> <password>' };
    username = await ask('Admin username: ');
  }
  if (!password) {
    if (!tty) return { error: 'Admin password required. Run: node server/seed.js <username> <password>' };
    password = await ask('Admin password: ', true);
  }
  if (!username) return { error: 'Username cannot be empty.' };
  if (password.length < MIN_PASSWORD) return { error: `Password too short (min ${MIN_PASSWORD} characters).` };
  return { username, password };
}

(async () => {
  try {
    await connect();
    if ((await User.countDocuments()) === 0) {
      const creds = await getAdminCreds();
      if (creds.error) { console.error('✗ ' + creds.error); process.exitCode = 1; return; }
      await User.create({ username: creds.username, passwordHash: await bcrypt.hash(creds.password, 10), fullName: 'Administrator', role: 'admin' });
      console.log(`✓ Admin "${creds.username}" created (stored hashed in MongoDB). Change the password after first login.`);
    } else console.log('· Users already exist — skipping admin creation.');

    await Vendor.updateOne({ name: 'Sample Factory Vendor' }, { $setOnInsert: { name: 'Sample Factory Vendor' } }, { upsert: true });
    const items = [
      ['M8 Hex Bolt Zinc', 'A-12'], ['Washer 8mm SS', 'A-13'], ['Anchor Fastener 10x100', 'C-04'],
    ];
    for (const [name, rack] of items) {
      await Product.updateOne({ normName: norm(name) }, { $set: { name, rack }, $setOnInsert: { normName: norm(name), aliases: [] } }, { upsert: true });
    }
    console.log('✓ Sample vendor and products added.');
  } catch (e) { console.error('Seed failed:', e.message); process.exitCode = 1; }
  finally { await mongoose.disconnect(); }
})();
