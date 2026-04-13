-- Seed Station Owners (passwords stored only as bcrypt hashes)
INSERT INTO "StationOwner" (
  id, email, password, name, cnpj, phone, role, status,
  "emailVerifiedAt", "approvedAt", "approvedByEmail", "createdAt", "updatedAt"
) VALUES
('owner1', 'joao@posto.com', '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy', 'João Silva', '12345678000190', '11999990001', 'OWNER', 'ACTIVE', NOW(), NOW(), 'admin@rotaposto.com', NOW(), NOW()),
('owner2', 'maria@posto.com', '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy', 'Maria Santos', '98765432000110', '11999990002', 'OWNER', 'ACTIVE', NOW(), NOW(), 'admin@rotaposto.com', NOW(), NOW()),
('admin1', 'admin@rotaposto.com', '$2b$10$RrVh5aorjiqfr4cBSsCe5em/oYGT8QwpRRF2f6wDe57IKQvkyhKyK', 'Admin Rotaposto', '11111111000191', '11999990099', 'ADMIN', 'ACTIVE', NOW(), NOW(), 'system', NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

-- Seed Verified Stations (OWNER source) in São Paulo
INSERT INTO "Station" (id, name, cnpj, address, lat, lng, brand, phone, source, "isVerified", "ownerId", "createdAt", "updatedAt") VALUES
('station1', 'Posto Shell Paulista', '12.345.678/0001-90', 'Av. Paulista, 1000 - Bela Vista, São Paulo', -23.5629, -46.6544, 'Shell', '(11) 3251-0000', 'OWNER', true, 'owner1', NOW(), NOW()),
('station2', 'Posto Ipiranga Centro', '98.765.432/0001-10', 'R. da Consolação, 500 - Consolação, São Paulo', -23.5505, -46.6580, 'Ipiranga', '(11) 3259-0000', 'OWNER', true, 'owner1', NOW(), NOW()),
('station3', 'Auto Posto BR Vila Mariana', '11.222.333/0001-44', 'Av. Domingos de Morais, 800 - Vila Mariana, São Paulo', -23.5912, -46.6367, 'BR', '(11) 5571-0000', 'OWNER', true, 'owner2', NOW(), NOW()),
('station4', 'Posto Petrobras Pinheiros', '55.666.777/0001-88', 'R. dos Pinheiros, 1500 - Pinheiros, São Paulo', -23.5670, -46.6870, 'Petrobras', '(11) 3032-0000', 'OWNER', true, 'owner2', NOW(), NOW()),
('station5', 'Posto Ale Moema', '44.555.666/0001-22', 'Av. Ibirapuera, 3000 - Moema, São Paulo', -23.6010, -46.6650, 'Ale', '(11) 5051-0000', 'OWNER', true, 'owner2', NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

-- Seed Unverified Stations (DRIVER source)
INSERT INTO "Station" (id, name, address, lat, lng, brand, source, "isVerified", "createdAt", "updatedAt") VALUES
('station6', 'Posto Bom Preço', 'R. Augusta, 2000 - Jardins, São Paulo', -23.5550, -46.6620, 'Bandeira Branca', 'DRIVER', false, NOW(), NOW()),
('station7', 'Auto Posto Economia', 'Av. Rebouças, 1200 - Pinheiros, São Paulo', -23.5610, -46.6780, NULL, 'DRIVER', false, NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

-- Seed Official Fuel Prices (from owners)
INSERT INTO "FuelPrice" (id, "fuelType", price, "stationId", "updatedAt") VALUES
-- Station 1 - Shell Paulista
('price1a', 'GASOLINE', 5.89, 'station1', NOW() - INTERVAL '2 hours'),
('price1b', 'ETHANOL', 3.99, 'station1', NOW() - INTERVAL '2 hours'),
('price1c', 'DIESEL', 5.49, 'station1', NOW() - INTERVAL '2 hours'),
-- Station 2 - Ipiranga Centro
('price2a', 'GASOLINE', 5.79, 'station2', NOW() - INTERVAL '12 hours'),
('price2b', 'ETHANOL', 3.89, 'station2', NOW() - INTERVAL '12 hours'),
-- Station 3 - BR Vila Mariana
('price3a', 'GASOLINE', 5.95, 'station3', NOW() - INTERVAL '36 hours'),
('price3b', 'ETHANOL', 4.05, 'station3', NOW() - INTERVAL '36 hours'),
('price3c', 'DIESEL', 5.59, 'station3', NOW() - INTERVAL '36 hours'),
('price3d', 'GNV', 4.19, 'station3', NOW() - INTERVAL '36 hours'),
-- Station 4 - Petrobras Pinheiros
('price4a', 'GASOLINE', 5.69, 'station4', NOW() - INTERVAL '80 hours'),
('price4b', 'ETHANOL', 3.79, 'station4', NOW() - INTERVAL '80 hours'),
-- Station 5 - Ale Moema
('price5a', 'GASOLINE', 5.75, 'station5', NOW() - INTERVAL '5 hours'),
('price5b', 'ETHANOL', 3.85, 'station5', NOW() - INTERVAL '5 hours'),
('price5c', 'DIESEL', 5.39, 'station5', NOW() - INTERVAL '5 hours')
ON CONFLICT (id) DO NOTHING;

-- Seed Driver Price Reports
INSERT INTO "DriverPriceReport" (id, "fuelType", price, "reporterHash", "reporterLat", "reporterLng", "stationId", "createdAt") VALUES
-- Recent reports for Station 1
('report1a', 'GASOLINE', 5.85, 'hash_user_001', -23.5630, -46.6545, 'station1', NOW() - INTERVAL '30 minutes'),
('report1b', 'ETHANOL', 3.95, 'hash_user_002', -23.5631, -46.6543, 'station1', NOW() - INTERVAL '1 hour'),
-- Reports for Station 2
('report2a', 'GASOLINE', 5.82, 'hash_user_003', -23.5506, -46.6581, 'station2', NOW() - INTERVAL '4 hours'),
-- Reports for Station 3 (some older)
('report3a', 'GASOLINE', 5.90, 'hash_user_004', -23.5913, -46.6368, 'station3', NOW() - INTERVAL '2 days'),
('report3b', 'DIESEL', 5.55, 'hash_user_005', -23.5911, -46.6366, 'station3', NOW() - INTERVAL '1 day'),
-- Reports for unverified Station 6
('report6a', 'GASOLINE', 5.65, 'hash_user_006', -23.5551, -46.6621, 'station6', NOW() - INTERVAL '6 hours'),
('report6b', 'ETHANOL', 3.75, 'hash_user_007', -23.5549, -46.6619, 'station6', NOW() - INTERVAL '3 hours')
ON CONFLICT (id) DO NOTHING;

-- Update location column for all stations
UPDATE "Station" 
SET location = ST_SetSRID(ST_MakePoint(lng, lat), 4326)::geography
WHERE location IS NULL;
