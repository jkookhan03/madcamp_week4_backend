const express = require('express');
const axios = require('axios');
const OpenAI = require('openai');
const cors = require('cors');
const mysql = require('mysql');
const multer = require('multer'); // 파일 업로드를 위한 Multer 모듈 추가
const fs = require('fs');
const path = require('path'); // 경로 조작을 위한 path 모듈 추가
require('dotenv').config();

const app = express();
const port = 80;

app.use(cors());
app.use(express.json());
app.use(express.static('public')); // public 폴더를 정적 파일 제공 폴더로 설정

const MUSIXMATCH_API_KEY = process.env.MUSIXMATCH_API_KEY;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

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

const openai = new OpenAI({
  apiKey: OPENAI_API_KEY,
});

// Multer 설정
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, path.join(__dirname, 'public/uploads/')); // 절대 경로 사용
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + '-' + file.originalname);
  }
});

const upload = multer({ storage: storage });

// 절대 경로 출력
const uploadsDir = path.join(__dirname, 'public/uploads/');
console.log(`Uploads directory absolute path: ${uploadsDir}`);

app.post('/generate-image', async (req, res) => {
  const { description } = req.body;

  try {
    const response = await openai.images.generate({
      model: "dall-e-3",
      prompt: description,
      n: 1,
      size: "1024x1024",
    });
    const imageUrl = response.data[0].url;
    const imagePath = path.join(__dirname, 'public/uploads/', Date.now() + '.png'); // 절대 경로 사용
    
    const writer = fs.createWriteStream(imagePath);
    const downloadResponse = await axios({
      url: imageUrl,
      method: 'GET',
      responseType: 'stream'
    });

    downloadResponse.data.pipe(writer);

    writer.on('finish', () => {
      res.status(200).json({ imageUrl: imagePath.replace(path.join(__dirname, 'public/'), '') });
    });

    writer.on('error', (error) => {
      console.error('Error saving image:', error);
      res.status(500).send('Error saving image');
    });
  } catch (error) {
    console.error('Error generating image:', error.response ? error.response.data : error.message);
    res.status(500).send('Error generating image');
  }
});

// 이미지 업로드 엔드포인트 추가
app.post('/upload-image', upload.single('image'), (req, res) => {
  const file = req.file;
  if (!file) {
    return res.status(400).send('No file uploaded.');
  }
  res.status(200).json({ imageUrl: `uploads/${file.filename}` });
});

// 기타 API 엔드포인트
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

  const query = 
    `INSERT INTO users (id, email, display_name, country, followers, profile_image_url, product)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    ON DUPLICATE KEY UPDATE
      email = VALUES(email),
      display_name = VALUES(display_name),
      country = VALUES(country),
      followers = VALUES(followers),
      profile_image_url = VALUES(profile_image_url),
      product = VALUES(product);`;

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

// 게시물 저장 API
app.post('/posts', (req, res) => {
  const { title, content, backgroundImage } = req.body;  // backgroundImage 추가
  const query = 'INSERT INTO posts (title, content, background_image) VALUES (?, ?, ?)';  // background_image 추가
  db.query(query, [title, JSON.stringify(content), backgroundImage], (error, results) => {
    if (error) {
      console.error('Error inserting post:', error);
      res.status(500).send('Server error');
      return;
    }
    res.status(200).send({ success: true, id: results.insertId });
  });
});

// 게시물 불러오기 API
app.get('/posts', (req, res) => {
  const query = 'SELECT * FROM posts';
  db.query(query, (error, results) => {
    if (error) {
      console.error('Error fetching posts:', error);
      res.status(500).send('Server error');
      return;
    }
    const posts = results.map(row => ({
      id: row.id,
      title: row.title,
      content: JSON.parse(row.content),
      backgroundImage: row.background_image,  // background_image 추가
    }));
    res.status(200).send(posts);
  });
});

// 개별 게시물 불러오기 API
app.get('/posts/:id', (req, res) => {
  const { id } = req.params;
  const query = 'SELECT * FROM posts WHERE id = ?';
  db.query(query, [id], (error, results) => {
    if (error) {
      console.error('Error fetching post:', error);
      res.status(500).send('Server error');
      return;
    }
    if (results.length === 0) {
      res.status(404).send('Post not found');
      return;
    }
    const post = {
      id: results[0].id,
      title: results[0].title,
      content: JSON.parse(results[0].content),
      backgroundImage: results[0].background_image,  // background_image 추가
    };
    res.status(200).send(post);
  });
});

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
