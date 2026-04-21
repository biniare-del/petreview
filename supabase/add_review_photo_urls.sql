-- 리뷰 이미지 첨부 (최대 3장, text[] 배열)
ALTER TABLE reviews ADD COLUMN IF NOT EXISTS review_photo_urls text[];
