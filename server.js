const express = require('express');
const axios = require('axios');
const OpenAI = require('openai');
const cors = require('cors');
require('dotenv').config();

const app = express();
const port = 80;

// CORS 미들웨어 설정
app.use(cors());

const MUSIXMATCH_API_KEY = process.env.MUSIXMATCH_API_KEY;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

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
