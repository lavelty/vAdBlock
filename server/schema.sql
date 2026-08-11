-- vAdBlock SponsorSkip veritabanı şeması
-- cPanel -> phpMyAdmin -> kendi DB'n -> SQL sekmesine yapıştır
-- (skipsegments.php tabloyu otomatik de oluşturur, gerek yok)

CREATE TABLE IF NOT EXISTS sponsor_segments (
    id INT AUTO_INCREMENT PRIMARY KEY,
    video_id VARCHAR(32) NOT NULL,
    start_time DECIMAL(10,2) NOT NULL,
    end_time DECIMAL(10,2) NOT NULL,
    category VARCHAR(32) NOT NULL DEFAULT 'sponsor',
    user_id VARCHAR(64) NOT NULL DEFAULT '',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_video (video_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
