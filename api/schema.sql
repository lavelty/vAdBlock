-- vAdBlock SponsorSkip veritabanı tabloları
-- phpMyAdmin (cPanel) üzerinden çalıştır: Import > bu dosya

CREATE TABLE IF NOT EXISTS segments (
    id INT AUTO_INCREMENT PRIMARY KEY,
    videoID VARCHAR(30) NOT NULL,
    startTime FLOAT NOT NULL,
    endTime FLOAT NOT NULL,
    category VARCHAR(30) NOT NULL,
    userID VARCHAR(64) NOT NULL,
    votes INT NOT NULL DEFAULT 1,
    hidden TINYINT NOT NULL DEFAULT 0,
    timeSubmitted INT NOT NULL,
    INDEX idx_videoID (videoID),
    INDEX idx_category (category)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
