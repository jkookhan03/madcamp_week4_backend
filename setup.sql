CREATE DATABASE IF NOT EXISTS madcamp_week4;
USE madcamp_week4;

CREATE TABLE IF NOT EXISTS users (
    id VARCHAR(50) PRIMARY KEY,
    email VARCHAR(100) NOT NULL,
    display_name VARCHAR(100),
    country CHAR(2),
    followers INT,
    profile_image_url VARCHAR(255),
    product VARCHAR(20),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
