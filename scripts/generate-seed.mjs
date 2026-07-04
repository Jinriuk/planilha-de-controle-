// ─────────────────────────────────────────────────────────────────────────
// Gera `supabase/seed.sql` a partir do array COMPANIES (extraído do HTML de
// referência `controle_apuracao_online.html`, seção `const COMPANIES`).
//
// Uso:  npm run seed:gen
//
// Campos vindos do HTML: cod, empresa, tipo, grupo, iss, icms, sf, sc,
// respPadrao, saiu (=> ativo = !saiu).
// Campos adicionais (cnpj, regime, municipio, uf) ficam NULL — devem ser
// complementados a partir do XLSX (LISTA_EMPRESAS_ATUALIZADA_062026.xlsx).
// ─────────────────────────────────────────────────────────────────────────
import { writeFileSync, mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))

const COMPANIES = [
  { cod: '8', empresa: 'AM Assessoria e Consultoria Tributária Ltda', tipo: 'Serviços', grupo: 'GRUPO 01', iss: true, icms: false, sf: false, sc: true, respPadrao: 'MARIANNA' },
  { cod: '10', empresa: 'Jomap Rio Bombas Injetoras e Peças Ltda', tipo: 'Comércio / Serviços', grupo: 'GRUPO 06', iss: true, icms: true, sf: true, sc: true, respPadrao: 'MARIA EDUARDA' },
  { cod: '17', empresa: 'Zilma de Oliveira Gonçalves Mercearia', tipo: 'Comércio', grupo: '', iss: false, icms: true, sf: true, sc: true, respPadrao: 'MARIA EDUARDA' },
  { cod: '23', empresa: 'Simples Saúde Serviços Médicos Ltda - Matriz', tipo: 'Serviços', grupo: 'GRUPO 17', iss: true, icms: false, sf: false, sc: true, respPadrao: 'MARIANNA' },
  { cod: '34', empresa: 'G.A Bombas Injetoras e Peças Ltda', tipo: 'Comércio / Serviços', grupo: 'GRUPO 06', iss: true, icms: true, sf: true, sc: true, respPadrao: 'MARIA EDUARDA' },
  { cod: '37', empresa: 'Guaitai Comércio de Roupas Ltda', tipo: 'Comércio', grupo: 'GRUPO 03', iss: false, icms: true, sf: true, sc: true, respPadrao: 'MARIA EDUARDA' },
  { cod: '54', empresa: 'Líder da Curicica Drogaria e Perfumaria Ltda', tipo: 'Comércio', grupo: 'GRUPO 24', iss: false, icms: true, sf: true, sc: true, respPadrao: 'MARIANNA' },
  { cod: '55', empresa: 'Hortifruti e Mercearia Curty Ltda', tipo: 'Comércio', grupo: 'GRUPO 24', iss: false, icms: true, sf: true, sc: true, respPadrao: 'MARIANNA' },
  { cod: '58', empresa: 'Juanil Transportes Rodoviários Ltda', tipo: 'Serviços', grupo: '', iss: true, icms: false, sf: false, sc: true, respPadrao: 'MARIA EDUARDA' },
  { cod: '60', empresa: 'Centro Médico de Mesquita Medicina Ltda', tipo: 'Serviços', grupo: 'GRUPO 06', iss: true, icms: false, sf: false, sc: true, respPadrao: 'MARIA EDUARDA' },
  { cod: '62', empresa: 'Nova Era Prime Corretora de Seguros de Vida, CAP e PP Ltda', tipo: 'Serviços', grupo: 'GRUPO 06', iss: true, icms: false, sf: false, sc: true, respPadrao: 'MARIA EDUARDA' },
  { cod: '63', empresa: 'JCC Corretora de Seguros Ltda', tipo: 'Serviços', grupo: '', iss: true, icms: false, sf: false, sc: true, respPadrao: 'MARIANNA' },
  { cod: '65', empresa: 'Belford Roxo Eletronics Express Ltda', tipo: 'Comércio / Serviços', grupo: 'GRUPO 04', iss: true, icms: true, sf: true, sc: true, respPadrao: 'MARIA EDUARDA' },
  { cod: '68', empresa: 'Costa Verde Comércio de Peças Motores e Serviços  Filial Mangaratiba', tipo: 'Comércio / Serviços', grupo: 'GRUPO 15', iss: true, icms: true, sf: true, sc: true, respPadrao: 'MARIANNA' },
  { cod: '69', empresa: 'Costa Verde Comércio de Peças Motores e Serviços  Matriz', tipo: 'Comércio / Serviços', grupo: 'GRUPO 15', iss: true, icms: true, sf: true, sc: true, respPadrao: 'MARIANNA' },
  { cod: '70', empresa: 'Costa Verde Motores Paraty Ltda - vai ser cancelada', tipo: 'Comércio / Serviços', grupo: 'GRUPO 15', iss: true, icms: true, sf: true, sc: true, respPadrao: 'MARIANNA' },
  { cod: '72', empresa: 'Central Assistência de Eletrônicos Ltda', tipo: 'Comércio / Serviços', grupo: 'GRUPO 04', iss: true, icms: true, sf: true, sc: true, respPadrao: 'MARIA EDUARDA' },
  { cod: '73', empresa: 'Linkcell Celulares Ltda (S/Certificado)', tipo: 'Serviços', grupo: 'GRUPO 04', iss: true, icms: false, sf: false, sc: true, respPadrao: 'MARIA EDUARDA' },
  { cod: '74', empresa: 'Madureira Reparação, Manut e Com de Equip de Com Ltda', tipo: 'Comércio / Serviços', grupo: 'GRUPO 04', iss: true, icms: true, sf: true, sc: true, respPadrao: 'MARIA EDUARDA' },
  { cod: '75', empresa: 'Nova Iguaçu Eletronics Expressa Ltda', tipo: 'Comércio / Serviços', grupo: 'GRUPO 04', iss: true, icms: true, sf: true, sc: true, respPadrao: 'MARIA EDUARDA' },
  { cod: '76', empresa: 'Paulo Pires Eletrônica Ltda (S/Certificado)', tipo: 'Comércio / Serviços', grupo: 'GRUPO 04', iss: true, icms: true, sf: true, sc: true, respPadrao: 'MARIA EDUARDA' },
  { cod: '82', empresa: 'Maciel Serv e Com de Peças e Acessórios para Veículos Ltda', tipo: 'Comércio / Serviços', grupo: '', iss: true, icms: true, sf: true, sc: true, respPadrao: 'MARIANNA' },
  { cod: '83', empresa: 'Auto Mecânica JG Ltda', tipo: 'Comércio / Serviços', grupo: 'GRUPO 10', iss: true, icms: true, sf: true, sc: true, respPadrao: 'MARIA EDUARDA' },
  { cod: '84', empresa: 'Atacadista Dois Irmãos Comércio Ltda', tipo: 'Comércio', grupo: '', iss: false, icms: true, sf: true, sc: true, respPadrao: 'MARIANNA' },
  { cod: '85', empresa: 'Multiplus R D Tecnologia e Serviços Automotivos Ltda', tipo: 'Comércio / Serviços', grupo: '', iss: true, icms: true, sf: true, sc: true, respPadrao: 'MARIANNA' },
  { cod: '86', empresa: 'P Olimpio da Silva Peças e Motos Ltda', tipo: 'Comércio', grupo: '', iss: false, icms: true, sf: true, sc: true, respPadrao: 'MARIA EDUARDA' },
  { cod: '87', empresa: 'Lorena Del Puppo Luz Serviços Médicos Ltda -  Matriz', tipo: 'Serviços', grupo: 'GRUPO 16', iss: true, icms: false, sf: false, sc: true, respPadrao: 'MARIA EDUARDA' },
  { cod: '89', empresa: 'TMC Serviços e Tecnologia Ltda - André', tipo: 'Serviços', grupo: '', iss: true, icms: false, sf: false, sc: true, respPadrao: 'MARIANNA' },
  { cod: '90', empresa: 'AM Contabilidade e Auditoria Ltda', tipo: 'Serviços', grupo: 'GRUPO 01', iss: true, icms: false, sf: false, sc: true, respPadrao: 'MARIANNA' },
  { cod: '91', empresa: 'JF Auto Diesel Mecânica Automotiva Ltda', tipo: 'Comércio / Serviços', grupo: '', iss: true, icms: true, sf: true, sc: true, respPadrao: 'MARIA EDUARDA' },
  { cod: '94', empresa: 'AC Comércio de Roupas e Acessórios Ltda', tipo: 'Comércio', grupo: 'GRUPO 03', iss: false, icms: true, sf: true, sc: true, respPadrao: 'MARIA EDUARDA' },
  { cod: '96', empresa: 'HSR Serviços Automotivos Ltda', tipo: 'Serviços', grupo: 'GRUPO 10', iss: true, icms: false, sf: false, sc: true, respPadrao: 'MARIA EDUARDA' },
  { cod: '99', empresa: 'Villa & Blue 2023 Restaurante Ltda', tipo: 'Comércio', grupo: '', iss: false, icms: true, sf: true, sc: true, respPadrao: 'MARIANNA' },
  { cod: '100', empresa: 'AGM H. PRODUTOS ALIMENTICIOS', tipo: 'Comércio', grupo: '', iss: false, icms: false, sf: false, sc: false, respPadrao: 'MARIANNA' },
  { cod: '103', empresa: 'C T V C Eletronica Ltda', tipo: 'Comércio / Serviços', grupo: 'GRUPO 04', iss: true, icms: true, sf: true, sc: true, respPadrao: 'MARIA EDUARDA' },
  { cod: '104', empresa: 'Posto de Molas Audax Comércio de Peças Ltda', tipo: 'Comércio / Serviços', grupo: '', iss: true, icms: true, sf: true, sc: true, respPadrao: 'MARIA EDUARDA' },
  { cod: '105', empresa: 'Nova União Irmãos Auto Center Ltda', tipo: 'Comércio / Serviços', grupo: '', iss: true, icms: true, sf: true, sc: true, respPadrao: 'MARIA EDUARDA' },
  { cod: '108', empresa: 'CARDOSO MONTAGNANI', tipo: 'Comércio / Serviços', grupo: '', iss: false, icms: false, sf: false, sc: false, respPadrao: 'MARIANNA' },
  { cod: '110', empresa: 'Simples Saúde Serviços Médicos Ltda - Filial', tipo: 'Serviços', grupo: 'GRUPO 17', iss: true, icms: false, sf: false, sc: true, respPadrao: 'MARIANNA' },
  { cod: '111', empresa: 'Lorena Del Puppo Luz Serviços Médicos Ltda -  Filial', tipo: 'Serviços', grupo: 'GRUPO 16', iss: true, icms: false, sf: false, sc: true, respPadrao: 'MARIA EDUARDA' },
  { cod: '114', empresa: 'BIGNETH', tipo: 'Comércio / Serviços', grupo: '', iss: false, icms: false, sf: false, sc: false, respPadrao: 'MARIA EDUARDA' },
  { cod: '119', empresa: 'Fênix RJ Com e Serv de Prod Industriais e Automotivos Ltda', tipo: 'Comércio / Serviços', grupo: '', iss: true, icms: true, sf: true, sc: true, respPadrao: 'MARIA EDUARDA' },
  { cod: '123', empresa: 'Rinelli Carrico Rianelli de Lima', tipo: 'Comércio / Serviços', grupo: '', iss: true, icms: true, sf: true, sc: true, respPadrao: 'MARIANNA' },
  { cod: '125', empresa: 'R2 Embalagens Comércio e Serviços Ltda', tipo: 'Comércio / Serviços', grupo: 'GRUPO 07', iss: true, icms: true, sf: true, sc: true, respPadrao: 'MARIA EDUARDA' },
  { cod: '126', empresa: 'R1 Comércio e Serviços Ltda', tipo: 'Comércio / Serviços', grupo: 'GRUPO 07', iss: true, icms: true, sf: true, sc: true, respPadrao: 'MARIA EDUARDA' },
  { cod: '127', empresa: 'Maricá Comércio e Serviços de Embalagens Ltda', tipo: 'Comércio / Serviços', grupo: 'GRUPO 07', iss: true, icms: true, sf: true, sc: true, respPadrao: 'MARIA EDUARDA' },
  { cod: '128', empresa: 'Baiaco Materiais de Construção Ltda', tipo: 'Comércio', grupo: '', iss: false, icms: true, sf: true, sc: true, respPadrao: 'MARIA EDUARDA' },
  { cod: '130', empresa: 'Espaço de Lazer Tucano Ltda', tipo: 'Comércio / Serviços', grupo: 'GRUPO 27', iss: true, icms: true, sf: true, sc: true, respPadrao: 'MARIANNA' },
  { cod: '131', empresa: 'Barras Vans Car Ltda', tipo: 'Comércio / Serviços', grupo: 'GRUPO 14', iss: true, icms: true, sf: true, sc: true, respPadrao: 'MARIA EDUARDA', saiu: true },
  { cod: '132', empresa: 'Ephraim Bikes Elétricas Ltda - Quitungo', tipo: 'Comércio / Serviços', grupo: 'GRUPO 14', iss: true, icms: true, sf: true, sc: true, respPadrao: 'MARIA EDUARDA', saiu: true },
  { cod: '133', empresa: 'Alex Alonso Gil Aluguel de Equipamentos e Serv. Engenharia', tipo: 'Serviços', grupo: '', iss: true, icms: false, sf: false, sc: true, respPadrao: 'MARIANNA' },
  { cod: '135', empresa: 'AJSP Empresa de Transp e Agencia de Turismo Ltda - 11', tipo: 'Comércio / Serviços', grupo: 'GRUPO 13', iss: true, icms: true, sf: true, sc: true, respPadrao: 'MARIANNA', saiu: true },
  { cod: '136', empresa: 'AJSP Empresa de Transp e Agencia de Turismo Ltda - 22', tipo: 'Comércio / Serviços', grupo: 'GRUPO 13', iss: true, icms: true, sf: true, sc: true, respPadrao: 'MARIANNA', saiu: true },
  { cod: '137', empresa: 'Transmartins Transportes e Turismo Ltda', tipo: 'Serviços', grupo: 'GRUPO 26', iss: true, icms: false, sf: false, sc: true, respPadrao: 'MARIA EDUARDA' },
  { cod: '138', empresa: 'Bmar Transportes e Logisticas Ltda - TC Transportes', tipo: 'Serviços', grupo: 'GRUPO 26', iss: true, icms: false, sf: false, sc: true, respPadrao: 'MARIA EDUARDA' },
  { cod: '141', empresa: 'Andrea D.S.A', tipo: 'Comércio / Serviços', grupo: '', iss: false, icms: false, sf: false, sc: false, respPadrao: 'MARIANNA' },
  { cod: '144', empresa: 'Studio Wolver Barber Designer Ltda', tipo: 'Serviços', grupo: 'GRUPO 14', iss: true, icms: false, sf: false, sc: true, respPadrao: 'MARIA EDUARDA', saiu: true },
  { cod: '145', empresa: 'Axiste Comercio de Produtos Medicos Hospitalares', tipo: 'Comércio', grupo: 'GRUPO 25', iss: false, icms: true, sf: true, sc: true, respPadrao: 'MARIANNA' },
  { cod: '146', empresa: 'Eco Medice - Distribuidora de Produtos Medicos Hospitalares', tipo: 'Comércio', grupo: 'GRUPO 25', iss: false, icms: true, sf: true, sc: true, respPadrao: 'MARIANNA' },
  { cod: '150', empresa: 'Cinticedi Medicina Nuclear Ltda', tipo: 'Serviços', grupo: 'GRUPO 19', iss: true, icms: false, sf: false, sc: true, respPadrao: 'MARIANNA' },
  { cod: '151', empresa: 'Cinticedi Medicina Nuclear Ltda', tipo: 'Serviços', grupo: 'GRUPO 19', iss: true, icms: false, sf: false, sc: true, respPadrao: 'MARIANNA' },
  { cod: '152', empresa: 'Cinticedi Medicina Nuclear Ltda', tipo: 'Serviços', grupo: 'GRUPO 19', iss: true, icms: false, sf: false, sc: true, respPadrao: 'MARIANNA' },
  { cod: '153', empresa: 'Cinticedi Medicina Nuclear Ltda', tipo: 'Serviços', grupo: 'GRUPO 19', iss: true, icms: false, sf: false, sc: true, respPadrao: 'MARIANNA' },
  { cod: '154', empresa: 'As Poderosas by Leticia Figueiredo Sociedade Empresarial Ltda', tipo: 'Comércio', grupo: 'GRUPO 12', iss: false, icms: true, sf: true, sc: true, respPadrao: 'MARIA EDUARDA' },
  { cod: '155', empresa: 'Hapia Veiculos Ltda', tipo: 'Comércio / Serviços', grupo: 'GRUPO 07', iss: true, icms: true, sf: true, sc: true, respPadrao: 'MARIA EDUARDA' },
  { cod: '156', empresa: 'Jacklux Quimica Ltda', tipo: 'Comércio / Serviços', grupo: '', iss: true, icms: true, sf: true, sc: true, respPadrao: 'MARIA EDUARDA' },
  { cod: '157', empresa: 'Promise Veiculos Ltda', tipo: 'Comércio / Serviços', grupo: 'GRUPO 07', iss: true, icms: true, sf: true, sc: true, respPadrao: 'MARIA EDUARDA' },
  { cod: '160', empresa: 'Ephraim Motos Elétricas Ltda', tipo: 'Comércio / Serviços', grupo: 'GRUPO 14', iss: true, icms: true, sf: true, sc: true, respPadrao: 'MARIA EDUARDA', saiu: true },
  { cod: '164', empresa: 'TopFire - Escola de Emergência Ltda', tipo: 'Serviços', grupo: 'GRUPO 08', iss: true, icms: false, sf: false, sc: true, respPadrao: 'MARIA EDUARDA' },
  { cod: '165', empresa: 'Efraym 8 Peças Diesel e Acessórios Ltda', tipo: 'Comércio / Serviços', grupo: '', iss: true, icms: true, sf: true, sc: true, respPadrao: 'MARIANNA' },
  { cod: '169', empresa: 'Ephraim Bikes Elétricas Ltda - Vila da Penha', tipo: 'Comércio / Serviços', grupo: 'GRUPO 14', iss: true, icms: true, sf: true, sc: true, respPadrao: 'MARIA EDUARDA', saiu: true },
  { cod: '170', empresa: 'HEAD INFORMATICA MULTIMARCAS LTDA', tipo: 'Comércio / Serviços', grupo: '', iss: false, icms: false, sf: false, sc: false, respPadrao: 'MARIANNA' },
  { cod: '171', empresa: 'R. S. Ribeiro Serviços e Tecnologia Automotiva Ltda', tipo: 'Serviços', grupo: '', iss: true, icms: false, sf: false, sc: true, respPadrao: 'MARIA EDUARDA' },
  { cod: '172', empresa: 'Medicine With BeautyServiços Ltda', tipo: 'Comércio / Serviços', grupo: 'GRUPO 09', iss: true, icms: true, sf: true, sc: true, respPadrao: 'MARIANNA' },
  { cod: '173', empresa: 'BV Arquitetura e Interiores Ltda', tipo: 'Serviços', grupo: '', iss: true, icms: false, sf: false, sc: true, respPadrao: 'MARIA EDUARDA' },
  { cod: '174', empresa: 'Fire Segmento Técnico Ltda', tipo: 'Serviços', grupo: 'GRUPO 08', iss: true, icms: false, sf: false, sc: true, respPadrao: 'MARIA EDUARDA' },
  { cod: '175', empresa: 'La Vie Café Ltda - ME', tipo: 'Comércio', grupo: 'GRUPO 09', iss: false, icms: true, sf: true, sc: true, respPadrao: 'MARIANNA' },
  { cod: '178', empresa: 'Clinica MWB Ltda', tipo: 'Serviços', grupo: 'GRUPO 09', iss: true, icms: false, sf: false, sc: true, respPadrao: 'MARIANNA' },
  { cod: '179', empresa: 'Costa Verde Comércio de Peças Motores e Serviços  Filial Paraty', tipo: 'Comércio / Serviços', grupo: 'GRUPO 15', iss: true, icms: true, sf: true, sc: true, respPadrao: 'MARIANNA' },
  { cod: '180', empresa: 'Costa Verde Comércio de Veículos Ltda', tipo: 'Comércio / Serviços', grupo: 'GRUPO 15', iss: true, icms: true, sf: true, sc: true, respPadrao: 'MARIANNA' },
  { cod: '181', empresa: 'Guedes e Gonçalves Comércio e Representações Ltda', tipo: 'Comércio / Serviços', grupo: 'GRUPO 23', iss: true, icms: true, sf: true, sc: true, respPadrao: 'MARIANNA' },
  { cod: '182', empresa: 'GVBV Comércio e Representações Ltda', tipo: 'Comércio', grupo: 'GRUPO 23', iss: false, icms: true, sf: true, sc: true, respPadrao: 'MARIANNA' },
  { cod: '183', empresa: 'Instituto de Medicina Comércio com Beleza Ltda', tipo: 'Comércio / Serviços', grupo: 'GRUPO 09', iss: true, icms: true, sf: true, sc: true, respPadrao: 'MARIANNA' },
  { cod: '184', empresa: 'TR Solution Terceirização de Serviços Ltda', tipo: 'Serviços', grupo: '', iss: true, icms: false, sf: false, sc: true, respPadrao: 'MARIANNA' },
  { cod: '185', empresa: 'Transtucano de Iguacu 2008 Ltda', tipo: 'Comércio / Serviços', grupo: 'GRUPO 27', iss: true, icms: true, sf: true, sc: true, respPadrao: 'MARIANNA' },
  { cod: '186', empresa: 'Vibe Embalagens Comércio de Descartáveis Ltda', tipo: 'Comércio', grupo: 'GRUPO 23', iss: false, icms: true, sf: true, sc: true, respPadrao: 'MARIANNA' },
  { cod: '187', empresa: 'Anestesiologia Albuquerque Ltda', tipo: 'Serviços', grupo: '', iss: true, icms: false, sf: false, sc: true, respPadrao: 'MARIA EDUARDA' },
  { cod: '188', empresa: 'Dynamis Soluções em Eletroeletrônicos Ltda', tipo: 'Comércio / Serviços', grupo: 'GRUPO 05', iss: true, icms: true, sf: true, sc: true, respPadrao: 'MARIANNA' },
  { cod: '189', empresa: 'Dynamis Soluções em Eletroeletrônicos Ltda', tipo: 'Comércio / Serviços', grupo: 'GRUPO 05', iss: true, icms: true, sf: true, sc: true, respPadrao: 'MARIANNA' },
  { cod: '190', empresa: 'Dynamis Soluções em Eletroeletrônicos Ltda', tipo: 'Comércio / Serviços', grupo: 'GRUPO 05', iss: true, icms: true, sf: true, sc: true, respPadrao: 'MARIANNA' },
  { cod: '191', empresa: 'Dynamis Soluções em Eletroeletrônicos Ltda', tipo: 'Comércio / Serviços', grupo: 'GRUPO 05', iss: true, icms: true, sf: true, sc: true, respPadrao: 'MARIANNA' },
  { cod: '192', empresa: 'Dynamis Soluções em Eletroeletrônicos Ltda', tipo: 'Comércio / Serviços', grupo: 'GRUPO 05', iss: true, icms: true, sf: true, sc: true, respPadrao: 'MARIANNA' },
  { cod: '193', empresa: 'Dynamis Soluções em Eletroeletrônicos Ltda', tipo: 'Comércio / Serviços', grupo: 'GRUPO 05', iss: true, icms: true, sf: true, sc: true, respPadrao: 'MARIANNA' },
  { cod: '194', empresa: 'GMB Comercio de Artigos Eletrônicos Ltda', tipo: 'Comércio / Serviços', grupo: 'GRUPO 05', iss: true, icms: true, sf: true, sc: true, respPadrao: 'MARIANNA' },
  { cod: '195', empresa: 'GMB Comercio de Artigos Eletrônicos Ltda', tipo: 'Comércio / Serviços', grupo: 'GRUPO 05', iss: true, icms: true, sf: true, sc: true, respPadrao: 'MARIANNA' },
  { cod: '196', empresa: 'GMB Comercio de Artigos Eletrônicos Ltda', tipo: 'Comércio / Serviços', grupo: 'GRUPO 05', iss: true, icms: true, sf: true, sc: true, respPadrao: 'MARIANNA' },
  { cod: '197', empresa: 'GMB Comercio de Artigos Eletrônicos Ltda', tipo: 'Comércio / Serviços', grupo: 'GRUPO 05', iss: true, icms: true, sf: true, sc: true, respPadrao: 'MARIANNA' },
  { cod: '198', empresa: 'Facility 01 Multimarcas Ltda', tipo: 'Comércio / Serviços', grupo: 'GRUPO 11', iss: true, icms: true, sf: true, sc: true, respPadrao: 'MARIA EDUARDA' },
  { cod: '199', empresa: 'Horus Premium', tipo: 'Comércio', grupo: 'GRUPO 11', iss: false, icms: true, sf: true, sc: true, respPadrao: 'MARIA EDUARDA' },
  { cod: '200', empresa: 'Sentinella Multimarcas Ltda', tipo: 'Comércio', grupo: 'GRUPO 11', iss: false, icms: true, sf: true, sc: true, respPadrao: 'MARIA EDUARDA' },
  { cod: '201', empresa: 'ROSELI CLEIDE OLIVEIRA LTDA', tipo: 'Comércio', grupo: '', iss: false, icms: false, sf: false, sc: false, respPadrao: 'MARIANNA' },
  { cod: '202', empresa: 'Studio Leticia Figueiredo Instituto de Beleza Ltda', tipo: 'Comércio / Serviços', grupo: 'GRUPO 12', iss: true, icms: true, sf: true, sc: true, respPadrao: 'MARIA EDUARDA' },
  { cod: '203', empresa: 'Adriana Ribeiro Figueiredo', tipo: 'Serviços', grupo: '', iss: true, icms: false, sf: false, sc: true, respPadrao: 'MARIANNA' },
  { cod: '204', empresa: 'Ivisa Assessoria Ltda', tipo: 'Serviços', grupo: '', iss: true, icms: false, sf: false, sc: true, respPadrao: 'MARIA EDUARDA' },
  { cod: '205', empresa: 'ECP - ENVIRON CONSULTORIA E PROJETOS LTDA', tipo: 'Comércio / Serviços', grupo: 'GRUPO 18', iss: false, icms: false, sf: false, sc: false, respPadrao: 'MARIA EDUARDA' },
  { cod: '207', empresa: 'TAP TECH LTDA', tipo: 'Comércio / Serviços', grupo: 'GRUPO 29', iss: false, icms: false, sf: false, sc: false, respPadrao: 'MARIA EDUARDA' },
  { cod: '208', empresa: 'SMART SERVICE ASSISTENCIA E ACESSORIOS LTDA', tipo: 'Comércio / Serviços', grupo: 'GRUPO 28', iss: false, icms: false, sf: false, sc: false, respPadrao: 'MARIA EDUARDA' },
  { cod: '210', empresa: 'RAJS TRADE MARKETING', tipo: 'Comércio / Serviços', grupo: '', iss: false, icms: false, sf: false, sc: false, respPadrao: 'MARIANNA' },
  { cod: '211', empresa: 'P&C SOLUÇÕES EMPRESARIAIS', tipo: 'Comércio / Serviços', grupo: 'GRUPO 21', iss: false, icms: false, sf: false, sc: false, respPadrao: 'MARIANNA' },
  { cod: '213', empresa: 'Cezar do Ar Instalação Automotiva Ltda', tipo: 'Comércio / Serviços', grupo: 'GRUPO 22', iss: false, icms: false, sf: false, sc: true, respPadrao: 'MARIANNA' },
  { cod: '214', empresa: 'Auto Elétrica e Refrigeração Boa Amizade Ltda', tipo: 'Comércio / Serviços', grupo: 'GRUPO 22', iss: true, icms: true, sf: true, sc: true, respPadrao: 'MARIANNA' },
  { cod: '215', empresa: 'FB Participações Imobiliárias Ltda', tipo: 'Comércio / Serviços', grupo: '', iss: true, icms: true, sf: true, sc: true, respPadrao: 'MARIA EDUARDA' },
  { cod: '216', empresa: 'LEFEL HOLDING E PARTICIPAÇÕES LTDA', tipo: 'Comércio / Serviços', grupo: 'GRUPO 18', iss: false, icms: false, sf: false, sc: false, respPadrao: 'MARIA EDUARDA' },
  { cod: '217', empresa: 'ECP - AGRO CONSULTORIA E PROJETOS LTDA', tipo: 'Comércio / Serviços', grupo: 'GRUPO 18', iss: false, icms: false, sf: false, sc: false, respPadrao: 'MARIA EDUARDA' },
  { cod: '218', empresa: 'GRUPO GARRA MANUTENCOES E SERVICOS LTDA', tipo: 'Comércio / Serviços', grupo: 'GRUPO 20', iss: false, icms: false, sf: false, sc: false, respPadrao: 'MARIANNA' },
  { cod: '219', empresa: 'GRUPO GARRA 2020 SERVICOS LTDA', tipo: 'Comércio / Serviços', grupo: 'GRUPO 20', iss: false, icms: false, sf: false, sc: false, respPadrao: 'MARIANNA' },
  { cod: '220', empresa: 'GARRA 2023 SERVIÇOES INTELIGENTES  LTDA', tipo: 'Comércio / Serviços', grupo: 'GRUPO 20', iss: false, icms: false, sf: false, sc: false, respPadrao: 'MARIANNA' },
  { cod: '221', empresa: 'GARRA 2024 SERVICOS DE MANUTENCOES LTDA', tipo: 'Comércio / Serviços', grupo: 'GRUPO 20', iss: false, icms: false, sf: false, sc: false, respPadrao: 'MARIANNA' },
  { cod: '222', empresa: 'GARRA 2025 SERVICO INTELIGENTE LTDA', tipo: 'Comércio / Serviços', grupo: 'GRUPO 20', iss: false, icms: false, sf: false, sc: false, respPadrao: 'MARIANNA' },
  { cod: '223', empresa: 'GARRA 2026 MANUTENCOES E SERVICOS LTDA', tipo: 'Comércio / Serviços', grupo: 'GRUPO 20', iss: false, icms: false, sf: false, sc: false, respPadrao: 'MARIANNA' },
  { cod: '224', empresa: 'P&C SOLUÇÕES EMPRESARIAIS', tipo: 'Comércio / Serviços', grupo: 'GRUPO 21', iss: false, icms: false, sf: false, sc: false, respPadrao: 'MARIANNA' },
  { cod: '225', empresa: 'AM Importadora E exportadora Ltda', tipo: 'Comércio', grupo: 'GRUPO 01', iss: false, icms: false, sf: false, sc: false, respPadrao: 'MARIANNA' },
  { cod: '226', empresa: 'Carmo Diniz Serviço e Comércio Ltda', tipo: 'Comércio / Serviços', grupo: '', iss: true, icms: true, sf: true, sc: true, respPadrao: 'MARIA EDUARDA' },
  { cod: '227', empresa: 'P&C SOLUÇÕES EMPRESARIAIS', tipo: 'Comércio / Serviços', grupo: 'GRUPO 21', iss: false, icms: false, sf: false, sc: false, respPadrao: 'MARIANNA' },
  { cod: '229', empresa: 'Leve Pocket Ltda', tipo: 'Comércio / Serviços', grupo: '', iss: false, icms: false, sf: false, sc: true, respPadrao: 'MARIANNA' },
  { cod: '230', empresa: 'FAZALL SERVIÇOS LTDA', tipo: 'Comércio / Serviços', grupo: '', iss: false, icms: false, sf: false, sc: false, respPadrao: 'MARIA EDUARDA' },
  { cod: '231', empresa: 'RIO VEDAS', tipo: 'Comércio / Serviços', grupo: '', iss: false, icms: false, sf: false, sc: false, respPadrao: 'MARIANNA' },
  { cod: '232', empresa: 'FAVORITA', tipo: 'Comércio / Serviços', grupo: '', iss: false, icms: false, sf: false, sc: false, respPadrao: 'MARIA EDUARDA' },
  { cod: '233', empresa: 'RBRX EMPREENDIMENTOS IMOBILIARIOS LTDA', tipo: 'Comércio / Serviços', grupo: '', iss: false, icms: false, sf: false, sc: false, respPadrao: 'MARIANNA' },
  { cod: '234', empresa: 'FORT RODAS DISTRIBUIDORA E COMERCIO LTDA', tipo: 'Comércio / Serviços', grupo: '', iss: false, icms: false, sf: false, sc: false, respPadrao: 'MARIA EDUARDA' },
  { cod: '235', empresa: 'Adalex Construções Ltda', tipo: 'Comércio / Serviços', grupo: '', iss: false, icms: false, sf: false, sc: false, respPadrao: 'MARIA EDUARDA' },
  { cod: '236', empresa: 'ALFA PORT', tipo: 'Serviços', grupo: '', iss: false, icms: false, sf: false, sc: false, respPadrao: 'MARIA EDUARDA' },
  { cod: '237', empresa: 'Anju Prieto', tipo: 'Comércio', grupo: '', iss: false, icms: false, sf: false, sc: false, respPadrao: 'MARIA EDUARDA' },
  { cod: '239', empresa: 'R S SPORT BIKE LTDA', tipo: 'Comércio', grupo: '', iss: false, icms: false, sf: false, sc: false, respPadrao: 'MARIA EDUARDA' },
  { cod: '240', empresa: 'ITAGUAI DIESEL COMERCIO DE PEÇAS PARA VEICULOS LTDA', tipo: 'Comércio', grupo: '', iss: false, icms: false, sf: false, sc: false, respPadrao: 'MARIA EDUARDA' },
  { cod: '241', empresa: 'CORAZA ATOMOTIVA LTDA', tipo: 'Serviços', grupo: '', iss: false, icms: false, sf: false, sc: false, respPadrao: 'MARIA EDUARDA' },
  { cod: '242', empresa: 'DROGARIA TIJUQUINHA LTDA', tipo: 'Comércio', grupo: '', iss: false, icms: false, sf: false, sc: false, respPadrao: 'MARIANNA' },
  { cod: '243', empresa: 'FARMACIA GAFEDIMA LTDA', tipo: 'Comércio', grupo: '', iss: false, icms: false, sf: false, sc: false, respPadrao: 'MARIANNA' },
  { cod: '244', empresa: 'BRAVO 1 SOLUCOES PATRIMONIAIS LTDA', tipo: 'Serviços', grupo: '', iss: false, icms: false, sf: false, sc: false, respPadrao: 'MARIA EDUARDA' },
  { cod: '245', empresa: 'SMART SERVICE ASSISTENCIA E ACESSORIOS LTDA', tipo: 'Comércio', grupo: 'GRUPO 28', iss: false, icms: false, sf: false, sc: false, respPadrao: 'MARIA EDUARDA' },
  { cod: '246', empresa: 'SMART SERVICE ASSISTENCIA E ACESSORIOS LTDA', tipo: 'Comércio', grupo: 'GRUPO 28', iss: false, icms: false, sf: false, sc: false, respPadrao: 'MARIA EDUARDA' },
  { cod: '247', empresa: 'SMART SERVICE ASSISTENCIA E ACESSORIOS LTDA', tipo: 'Comércio', grupo: 'GRUPO 28', iss: false, icms: false, sf: false, sc: false, respPadrao: 'MARIA EDUARDA' },
  { cod: '248', empresa: 'P&C SOLUÇÕES EMPRESARIAIS', tipo: 'Serviços', grupo: 'GRUPO 21', iss: false, icms: false, sf: false, sc: false, respPadrao: 'MARIANNA' },
  { cod: '249', empresa: 'TAP TECH LTDA', tipo: 'Comércio', grupo: 'GRUPO 29', iss: false, icms: false, sf: false, sc: false, respPadrao: 'MARIA EDUARDA' },
  { cod: '250', empresa: 'TAP TECH LTDA', tipo: 'Comércio', grupo: 'GRUPO 29', iss: false, icms: false, sf: false, sc: false, respPadrao: 'MARIA EDUARDA' },
  { cod: '251', empresa: 'TAP TECH LTDA', tipo: 'Comércio', grupo: 'GRUPO 29', iss: false, icms: false, sf: false, sc: false, respPadrao: 'MARIA EDUARDA' },
  { cod: '252', empresa: 'CONECTTA ACESSORIOS E SOLUCOES LTDA', tipo: 'Comércio', grupo: 'GRUPO 30', iss: false, icms: false, sf: false, sc: false, respPadrao: 'MARIA EDUARDA' },
  { cod: '253', empresa: 'CONECTTA ACESSORIOS E SOLUCOES LTDA', tipo: 'Comércio', grupo: 'GRUPO 30', iss: false, icms: false, sf: false, sc: false, respPadrao: 'MARIA EDUARDA' },
  { cod: '254', empresa: 'CONECTTA ACESSORIOS E SOLUCOES LTDA', tipo: 'Comércio', grupo: 'GRUPO 30', iss: false, icms: false, sf: false, sc: false, respPadrao: 'MARIA EDUARDA' },
  { cod: '255', empresa: 'SOLUTECH ARTIGOS E ACESSÓRIOS ELETRÔNICOS LTDA', tipo: 'Comércio', grupo: 'GRUPO 32', iss: false, icms: false, sf: false, sc: false, respPadrao: 'MARIANNA' },
  { cod: '256', empresa: 'SOLUTECH ARTIGOS E ACESSÓRIOS ELETRÔNICOS LTDA', tipo: 'Comércio', grupo: 'GRUPO 32', iss: false, icms: false, sf: false, sc: false, respPadrao: 'MARIANNA' },
  { cod: '257', empresa: 'SOLUTECH ARTIGOS E ACESSÓRIOS ELETRÔNICOS LTDA', tipo: 'Comércio', grupo: 'GRUPO 32', iss: false, icms: false, sf: false, sc: false, respPadrao: 'MARIANNA' },
  { cod: '258', empresa: 'SOLUTECH ARTIGOS E ACESSÓRIOS ELETRÔNICOS LTDA', tipo: 'Comércio', grupo: 'GRUPO 32', iss: false, icms: false, sf: false, sc: false, respPadrao: 'MARIANNA' },
  { cod: '259', empresa: 'THDG. COM TECHNOLOGY E COMERCIO LTDA EPP', tipo: 'Comércio', grupo: 'GRUPO 33', iss: false, icms: false, sf: false, sc: false, respPadrao: 'MARIA EDUARDA' },
  { cod: '260', empresa: 'THDG. COM TECHNOLOGY E COMERCIO LTDA EPP', tipo: 'Comércio', grupo: 'GRUPO 33', iss: false, icms: false, sf: false, sc: false, respPadrao: 'MARIA EDUARDA' },
  { cod: '261', empresa: 'THDG. COM TECHNOLOGY E COMERCIO LTDA EPP', tipo: 'Comércio', grupo: 'GRUPO 33', iss: false, icms: false, sf: false, sc: false, respPadrao: 'MARIA EDUARDA' },
  { cod: '262', empresa: 'THDG. COM TECHNOLOGY E COMERCIO LTDA EPP', tipo: 'Comércio', grupo: 'GRUPO 33', iss: false, icms: false, sf: false, sc: false, respPadrao: 'MARIA EDUARDA' },
  { cod: '263', empresa: 'THDG. COM TECHNOLOGY E COMERCIO LTDA EPP', tipo: 'Comércio', grupo: 'GRUPO 33', iss: false, icms: false, sf: false, sc: false, respPadrao: 'MARIA EDUARDA' },
  { cod: '264', empresa: 'THDG. COM TECHNOLOGY E COMERCIO LTDA EPP', tipo: 'Comércio', grupo: 'GRUPO 33', iss: false, icms: false, sf: false, sc: false, respPadrao: 'MARIA EDUARDA' },
  { cod: '265', empresa: 'THDG. COM TECHNOLOGY E COMERCIO LTDA EPP', tipo: 'Comércio', grupo: 'GRUPO 33', iss: false, icms: false, sf: false, sc: false, respPadrao: 'MARIA EDUARDA' },
  { cod: '266', empresa: 'THDG. COM TECHNOLOGY E COMERCIO LTDA EPP', tipo: 'Comércio', grupo: 'GRUPO 33', iss: false, icms: false, sf: false, sc: false, respPadrao: 'MARIA EDUARDA' },
  { cod: '267', empresa: 'THDG. COM TECHNOLOGY E COMERCIO LTDA EPP', tipo: 'Comércio', grupo: 'GRUPO 33', iss: false, icms: false, sf: false, sc: false, respPadrao: 'MARIA EDUARDA' },
  { cod: '268', empresa: 'C&S CONSULTORIA E TECNOLOGIA LTDA', tipo: 'Serviços', grupo: '', iss: false, icms: false, sf: false, sc: false, respPadrao: 'MARIA EDUARDA' },
  { cod: '269', empresa: 'G20 IMPORTAÇÃO MAGAZINE LTDA', tipo: 'Comércio', grupo: 'GRUPO 34', iss: false, icms: false, sf: false, sc: false, respPadrao: 'MARIANNA' },
  { cod: '270', empresa: 'G20 IMPORTAÇÃO & COMÉRCIO LTDA', tipo: 'Comércio', grupo: 'GRUPO 34', iss: false, icms: false, sf: false, sc: false, respPadrao: 'MARIANNA' },
  { cod: '271', empresa: 'G20 COMÉRCIO VAREJISTA E ATACADISTA LTDA', tipo: 'Comércio', grupo: 'GRUPO 34', iss: false, icms: false, sf: false, sc: false, respPadrao: 'MARIANNA' },
  { cod: '272', empresa: 'G10 MAGAZINE IMPORTAÇÃO E COMÉRCIO LTDA', tipo: 'Comércio', grupo: 'GRUPO 34', iss: false, icms: false, sf: false, sc: false, respPadrao: 'MARIANNA' },
  { cod: '273', empresa: 'GR IMPORTADOS COMERCIO ARTIGOS ARMARINHO LTDA', tipo: 'Comércio', grupo: 'GRUPO 34', iss: false, icms: false, sf: false, sc: false, respPadrao: 'MARIANNA' },
]

const esc = (s) => (s == null ? '' : String(s).replace(/'/g, "''"))
const bool = (b) => (b ? 'true' : 'false')
const textOrNull = (s) => (s ? `'${esc(s)}'` : 'null')

const rows = COMPANIES.map((c) => {
  const ativo = c.saiu ? false : true
  return `  ('${esc(c.cod)}', '${esc(c.empresa)}', ${textOrNull(c.tipo)}, ${textOrNull(c.grupo)}, ` +
    `${bool(c.iss)}, ${bool(c.icms)}, ${bool(c.sf)}, ${bool(c.sc)}, ${textOrNull(c.respPadrao)}, ${bool(ativo)})`
})

const ativos = COMPANIES.filter((c) => !c.saiu).length
const inativos = COMPANIES.length - ativos

const sql = `-- ─────────────────────────────────────────────────────────────────────────
-- SEED: companies  (GERADO AUTOMATICAMENTE por scripts/generate-seed.mjs)
-- NÃO edite à mão — rode \`npm run seed:gen\` para regenerar.
--
-- Total: ${COMPANIES.length} empresas  |  ${ativos} ativas  |  ${inativos} inativas (SAIU)
-- Fonte: array COMPANIES do controle_apuracao_online.html
-- cnpj / regime / municipio / uf ficam NULL (complementar via XLSX).
-- ─────────────────────────────────────────────────────────────────────────

insert into public.companies
  (cod, empresa, tipo, grupo, iss, icms, sf, sc, resp_padrao, ativo)
values
${rows.join(',\n')}
on conflict (cod) do update set
  empresa     = excluded.empresa,
  tipo        = excluded.tipo,
  grupo       = excluded.grupo,
  iss         = excluded.iss,
  icms        = excluded.icms,
  sf          = excluded.sf,
  sc          = excluded.sc,
  resp_padrao = excluded.resp_padrao,
  ativo       = excluded.ativo;
`

const outPath = resolve(__dirname, '../supabase/seed.sql')
mkdirSync(dirname(outPath), { recursive: true })
writeFileSync(outPath, sql, 'utf8')
console.log(`✓ seed.sql gerado: ${COMPANIES.length} empresas (${ativos} ativas, ${inativos} inativas) → ${outPath}`)
