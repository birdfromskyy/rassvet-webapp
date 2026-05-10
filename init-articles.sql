-- Этот скрипт будет выполнен Directus автоматически при первом запуске
-- Но мы создадим его для документации структуры

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Таблица articles будет создана Directus автоматически
-- Это просто пример структуры которая будет создана

/*
CREATE TABLE IF NOT EXISTS articles (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    status VARCHAR(255) DEFAULT 'draft',
    sort INTEGER,
    user_created UUID,
    date_created TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    user_updated UUID,
    date_updated TIMESTAMP WITH TIME ZONE,
    
    title VARCHAR(255) NOT NULL,
    slug VARCHAR(255) UNIQUE,
    summary TEXT,
    content TEXT,
    featured_image UUID,
    
    category VARCHAR(255),
    tags JSONB,
    author VARCHAR(255),
    published_at TIMESTAMP WITH TIME ZONE,
    view_count INTEGER DEFAULT 0,
    
    meta_title VARCHAR(255),
    meta_description TEXT
);

CREATE INDEX idx_articles_status ON articles(status);
CREATE INDEX idx_articles_slug ON articles(slug);
CREATE INDEX idx_articles_published_at ON articles(published_at);
CREATE INDEX idx_articles_category ON articles(category);
*/