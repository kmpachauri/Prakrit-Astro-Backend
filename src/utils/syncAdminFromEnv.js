const bcrypt = require('bcryptjs');
const Admin = require('../models/Admin');

async function syncAdminFromEnv() {
  const email = (process.env.ADMIN_EMAIL || '').trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD || '';
  const name = (process.env.ADMIN_NAME || 'Administrator').trim();

  if (!email || !password) {
    console.warn('ADMIN_EMAIL or ADMIN_PASSWORD is missing. Admin credential sync skipped.');
    return;
  }

  if (password.length < 8) {
    console.warn('ADMIN_PASSWORD must be at least 8 characters. Admin credential sync skipped.');
    return;
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const admin = await Admin.findOne({ email })
    || await Admin.findOne({ role: 'super_admin' })
    || await Admin.findOne().sort({ createdAt: 1 });

  if (admin) {
    admin.name = name;
    admin.email = email;
    admin.passwordHash = passwordHash;
    admin.role = 'super_admin';
    admin.status = 'active';
    await admin.save();
    await Admin.updateMany({ _id: { $ne: admin._id } }, { $set: { status: 'inactive' } });
    console.log(`Admin credentials synced from .env for ${email}.`);
    return;
  }

  await Admin.create({
    name,
    email,
    passwordHash,
    role: 'super_admin',
    status: 'active'
  });
  await Admin.updateMany({ email: { $ne: email } }, { $set: { status: 'inactive' } });
  console.log(`Admin user created from .env for ${email}.`);
}

module.exports = syncAdminFromEnv;
