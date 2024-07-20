const express = require('express');
const axios = require('axios');
const OpenAI = require('openai');
const cors = require('cors');
const mysql = require('mysql');
require('dotenv').config();

const app = express();
const port = 80;

// CORS 미들웨어 설정
app.use(cors());
app.use(express.json());

const MUSIXMATCH_API_KEY = process.env.MUSIXMATCH_API_KEY;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

// MySQL 데이터베이스 연결 설정
const db = mysql.createConnection({
  host: 'localhost',
  user: 'root',
  password: '1234',
  database: 'madcamp_week4'
});

db.connect((err) => {
  if (err) {
    console.error('Error connecting to the database:', err);
    return;
  }
  console.log('Connected to the MySQL database.');
});

// OpenAI API 클라이언트 설정
const openai = new OpenAI({
  apiKey: OPENAI_API_KEY,
});

app.get('/lyrics', async (req, res) => {
  const { track, artist, targetLang } = req.query;

  try {
    const lyricsResponse = await axios.get('https://api.musixmatch.com/ws/1.1/matcher.lyrics.get', {
      params: {
        q_track: track,
        q_artist: artist,
        apikey: MUSIXMATCH_API_KEY,
      },
    });

    const lyrics = lyricsResponse.data.message.body.lyrics.lyrics_body;

    if (!lyrics) {
      return res.status(404).send('Lyrics not found');
    }

    if (targetLang && targetLang !== 'en') {
      const translatedLyrics = await translateLyrics(lyrics, targetLang);
      res.send({ original: lyrics, translated: translatedLyrics });
    } else {
      res.send({ original: lyrics });
    }
  } catch (error) {
    console.error('Error fetching lyrics or translating:', error.response ? error.response.data : error.message);
    res.status(500).send('Error fetching lyrics or translating');
  }
});

app.post('/saveUser', (req, res) => {
  const { id, email, display_name, country, followers, profile_image_url, product } = req.body;

  const query = `
    INSERT INTO users (id, email, display_name, country, followers, profile_image_url, product)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    ON DUPLICATE KEY UPDATE
      email = VALUES(email),
      display_name = VALUES(display_name),
      country = VALUES(country),
      followers = VALUES(followers),
      profile_image_url = VALUES(profile_image_url),
      product = VALUES(product)
  `;

  const values = [id, email, display_name, country, followers, profile_image_url, product];

  db.query(query, values, (err, results) => {
    if (err) {
      console.error('Error saving user to the database:', err);
      return res.status(500).send('Error saving user to the database');
    }
    res.send('User saved successfully');
  });
});

async function translateLyrics(lyrics, targetLang) {
  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [
        { role: 'system', content: 'You are a helpful assistant.' },
        { role: 'user', content: `Translate the following sentences to ${targetLang}:\n\n${lyrics}` },
      ],
      max_tokens: 1000,
    });

    return response.choices[0].message.content.trim();
  } catch (error) {
    console.error('Error translating lyrics:', error.response ? error.response.data : error.message);
    throw error;
  }
}

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
