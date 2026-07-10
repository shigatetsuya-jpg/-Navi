-- =====================================================================
-- MIND/STYLE  DBセットアップスクリプト (H2 / jdbc:h2:~/h2db/mydb)
-- H2 Console などでこのスクリプトを実行するとテーブルと初期データが作成されます。
-- 再実行できるように、既存テーブルを一度削除してから作り直します。
-- =====================================================================

-- 外部参照の順序を考慮して削除
DROP TABLE IF EXISTS SHOPPING_CART;
DROP TABLE IF EXISTS PURCHASE_ORDER;
DROP TABLE IF EXISTS PRODUCT_SET_ITEM;
DROP TABLE IF EXISTS PRODUCT_SET_STOCK;
DROP TABLE IF EXISTS PRODUCT_INFO;
DROP TABLE IF EXISTS PRODUCT_SET;

-- ---------------------------------------------------------------------
-- セット商品マスタ
-- ---------------------------------------------------------------------
CREATE TABLE PRODUCT_SET (
  SET_ID        INT PRIMARY KEY,
  SET_NAME      VARCHAR(100),
  SET_PRICE     INT,
  SET_DETAIL    VARCHAR(255),
  CATEGORY_NAME VARCHAR(50),
  MAKER_NAME    VARCHAR(50),
  MATERIAL      VARCHAR(50),
  SIZE          VARCHAR(50),
  SET_IMAGE     VARCHAR(100)
);

-- ---------------------------------------------------------------------
-- セット在庫（SET_IDごとの在庫数）
-- ---------------------------------------------------------------------
CREATE TABLE PRODUCT_SET_STOCK (
  SET_ID    INT PRIMARY KEY,
  STOCK_NUM INT
);

-- ---------------------------------------------------------------------
-- 個別商品マスタ（セットに含まれる各アイテム）
-- ---------------------------------------------------------------------
CREATE TABLE PRODUCT_INFO (
  PRODUCT_CODE VARCHAR(20) PRIMARY KEY,
  PRODUCT_NAME VARCHAR(100),
  PRICE        INT,
  SIZE         VARCHAR(10)
);

-- ---------------------------------------------------------------------
-- セット構成（どのセットにどの商品が何個入るか）
-- ---------------------------------------------------------------------
CREATE TABLE PRODUCT_SET_ITEM (
  SET_ID       INT,
  PRODUCT_CODE VARCHAR(20),
  PRODUCT_NAME VARCHAR(100),
  QUANTITY     INT
);

-- ---------------------------------------------------------------------
-- ショッピングカート（セッションごと）
-- ---------------------------------------------------------------------
CREATE TABLE SHOPPING_CART (
  CART_ID      INT AUTO_INCREMENT PRIMARY KEY,
  SESSION_ID   VARCHAR(100),
  PRODUCT_CODE VARCHAR(20),
  SET_NAME     VARCHAR(100),
  PRODUCT_SIZE VARCHAR(10),
  PRICE        INT,
  QUANTITY     INT
);

-- ---------------------------------------------------------------------
-- 注文
-- ---------------------------------------------------------------------
CREATE TABLE PURCHASE_ORDER (
  ORDER_ID       INT AUTO_INCREMENT PRIMARY KEY,
  CUSTOMER_NAME  VARCHAR(100),
  PHONE          VARCHAR(20),
  ADDRESS        VARCHAR(255),
  PAYMENT_METHOD VARCHAR(50),
  TOTAL_AMOUNT   INT,
  ORDER_STATUS   VARCHAR(20),
  ORDER_DATE     TIMESTAMP
);

-- =====================================================================
-- 初期データ
-- =====================================================================

-- セット商品
INSERT INTO PRODUCT_SET VALUES (1, 'メンズ ジャケット&パンツ セット', 15000, 'ジャケットとパンツのビジネスセット', 'メンズ', 'MIND', 'ウール', 'S/M/L/XL', 'set1.jpg');
INSERT INTO PRODUCT_SET VALUES (2, 'レディース コート&スカート セット', 20000, 'コートとスカートの冬コーデセット', 'レディース', 'STYLE', 'カシミヤ', 'S/M/L', 'set2.jpg');
INSERT INTO PRODUCT_SET VALUES (3, 'ユニセックス パーカー&パンツ セット', 9800, 'パーカーとパンツのカジュアルセット', 'ユニセックス', 'MIND', 'コットン', 'S/M/L/XL', 'set3.jpg');
INSERT INTO PRODUCT_SET VALUES (4, 'メンズ シャツ&チノパン セット', 12000, 'シャツとチノパンのきれいめセット', 'メンズ', 'STYLE', 'コットン', 'M/L/XL', 'set4.jpg');

-- 在庫（3=残りわずか, 0=在庫なし で動作確認できるようにしています）
INSERT INTO PRODUCT_SET_STOCK VALUES (1, 5);
INSERT INTO PRODUCT_SET_STOCK VALUES (2, 3);
INSERT INTO PRODUCT_SET_STOCK VALUES (3, 10);
INSERT INTO PRODUCT_SET_STOCK VALUES (4, 0);

-- 個別商品
INSERT INTO PRODUCT_INFO VALUES ('JACKET-01', 'テーラードジャケット', 10000, 'M');
INSERT INTO PRODUCT_INFO VALUES ('PANTS-01',  'スラックス',           5000,  'M');
INSERT INTO PRODUCT_INFO VALUES ('COAT-01',   'ロングコート',         14000, 'M');
INSERT INTO PRODUCT_INFO VALUES ('SKIRT-01',  'プリーツスカート',      6000,  'M');
INSERT INTO PRODUCT_INFO VALUES ('HOODIE-01', 'プルオーバーパーカー',  5800,  'M');
INSERT INTO PRODUCT_INFO VALUES ('PANTS-02',  'イージーパンツ',        4000,  'M');
INSERT INTO PRODUCT_INFO VALUES ('SHIRT-01',  'オックスフォードシャツ', 6000,  'M');
INSERT INTO PRODUCT_INFO VALUES ('CHINO-01',  'チノパン',              6000,  'M');

-- セット構成
INSERT INTO PRODUCT_SET_ITEM VALUES (1, 'JACKET-01', 'テーラードジャケット', 1);
INSERT INTO PRODUCT_SET_ITEM VALUES (1, 'PANTS-01',  'スラックス',           1);
INSERT INTO PRODUCT_SET_ITEM VALUES (2, 'COAT-01',   'ロングコート',         1);
INSERT INTO PRODUCT_SET_ITEM VALUES (2, 'SKIRT-01',  'プリーツスカート',      1);
INSERT INTO PRODUCT_SET_ITEM VALUES (3, 'HOODIE-01', 'プルオーバーパーカー',  1);
INSERT INTO PRODUCT_SET_ITEM VALUES (3, 'PANTS-02',  'イージーパンツ',        1);
INSERT INTO PRODUCT_SET_ITEM VALUES (4, 'SHIRT-01',  'オックスフォードシャツ', 1);
INSERT INTO PRODUCT_SET_ITEM VALUES (4, 'CHINO-01',  'チノパン',              1);
