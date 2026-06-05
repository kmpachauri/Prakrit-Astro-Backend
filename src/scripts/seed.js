const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../../.env') });

const FAQ = require('../models/FAQ');

const faqs = [
  {
    question: 'When and where is the workshop and how long it would be?',
    answer: 'Workshop schedule, platform, and duration details will be shared on WhatsApp after successful registration. Please join the WhatsApp group to receive all updates.',
    language: 'hinglish',
    isActive: true,
    order: 1
  },
  {
    question: 'For whom is this workshop?',
    answer: 'This workshop is designed for students in classes 8th to 12th and their parents who are confused about career direction, stream selection, or future planning. It is also helpful for anyone seeking astrological guidance for career-related decisions.',
    language: 'hinglish',
    isActive: true,
    order: 2
  },
  {
    question: 'How will this workshop help me?',
    answer: 'This workshop provides astrological insights into your natural strengths, suitable career paths, and timing of important opportunities. It helps you make informed decisions about education and career with clarity and confidence.',
    language: 'hinglish',
    isActive: true,
    order: 3
  },
  {
    question: 'What should I be prepared with before the workshop starts?',
    answer: 'Please keep your date of birth, time of birth, and place of birth ready. A stable internet connection and a quiet place to attend will help you get the most out of the session.',
    language: 'hinglish',
    isActive: true,
    order: 4
  },
  {
    question: 'Will I get the recordings of the workshop?',
    answer: 'Prakrit Astro conducts live sessions only. Recordings are generally not provided. We recommend attending the live session to get the full benefit and to ask questions directly.',
    language: 'hinglish',
    isActive: true,
    order: 5
  }
];

async function seedFAQs() {
  try {
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/prakritastro');
    console.log('Connected to MongoDB.');

    for (const faq of faqs) {
      const exists = await FAQ.findOne({ question: faq.question });
      if (!exists) {
        await FAQ.create(faq);
        console.log(`Created FAQ: "${faq.question.substring(0, 50)}..."`);
      } else {
        console.log(`Already exists, skipped: "${faq.question.substring(0, 50)}..."`);
      }
    }

    console.log('FAQ seeding complete.');
  } catch (err) {
    console.error('Seeding failed:', err.message);
  } finally {
    await mongoose.disconnect();
  }
}

seedFAQs();
