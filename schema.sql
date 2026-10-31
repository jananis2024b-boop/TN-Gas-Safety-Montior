-- PostgreSQL (+PostGIS optional) schema for production use. The demo server keeps data in memory.
CREATE TABLE districts(id SERIAL PRIMARY KEY,name TEXT UNIQUE NOT NULL,lat DOUBLE PRECISION,lng DOUBLE PRECISION);
CREATE TABLE industry_categories(id SERIAL PRIMARY KEY,name TEXT UNIQUE NOT NULL);
CREATE TABLE companies(id TEXT PRIMARY KEY,name TEXT NOT NULL,category_id INT REFERENCES industry_categories,district_id INT REFERENCES districts,address TEXT,lat DOUBLE PRECISION,lng DOUBLE PRECISION,contact TEXT,website TEXT,activity TEXT,record_type TEXT CHECK(record_type IN('VERIFIED','IMPORTED','DEMO')),source_url TEXT,updated_at TIMESTAMPTZ DEFAULT now());
CREATE TABLE gas_thresholds(gas TEXT PRIMARY KEY,name TEXT,unit TEXT,mode TEXT CHECK(mode IN('high','low')),warning NUMERIC,critical NUMERIC,danger NUMERIC);
CREATE TABLE gas_sensors(id SERIAL PRIMARY KEY,company_id TEXT REFERENCES companies,gas TEXT REFERENCES gas_thresholds,device_id TEXT NOT NULL,UNIQUE(device_id,gas));
CREATE TABLE gas_readings(sensor_id INT REFERENCES gas_sensors,ts TIMESTAMPTZ NOT NULL,value NUMERIC NOT NULL,source TEXT);
CREATE INDEX ON gas_readings(sensor_id,ts DESC);
CREATE TABLE alerts(id SERIAL PRIMARY KEY,company_id TEXT REFERENCES companies,gas TEXT,level TEXT,peak_level TEXT,value NUMERIC,threshold NUMERIC,started_at TIMESTAMPTZ,updated_at TIMESTAMPTZ,resolved_at TIMESTAMPTZ,acked_by TEXT);
CREATE TABLE users(id SERIAL PRIMARY KEY,email TEXT UNIQUE,password_hash TEXT,role TEXT CHECK(role IN('admin','operator','viewer')));
