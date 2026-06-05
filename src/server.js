const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

// Load environment variables from backend root directory
dotenv.config({ path: path.join(__dirname, '../.env') });

const app = require('./app');

const PORT = process.env.PORT || 5000;
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/prakritastro';

console.log('Starting Prakrit Astro Server...');

mongoose.connect(MONGO_URI)
.then(() => {
  console.log('Connected to MongoDB database successfully.');
  app.listen(PORT, () => {
    console.log(`Server is running in ${process.env.NODE_ENV || 'development'} mode on port ${PORT}`);
  });
})
.catch(err => {
  console.error('Database connection failed! Server shutting down.', err);
  process.exit(1);
});
