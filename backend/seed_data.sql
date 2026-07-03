CREATE TABLE IF NOT EXISTS core_metrics (
  enterprise_id VARCHAR(64) PRIMARY KEY, enterprise_name VARCHAR(200),
  industry_l1 VARCHAR(50), industry_l2 VARCHAR(50), province VARCHAR(50), city VARCHAR(50),
  credit_level CHAR(1), credit_score NUMERIC(5,2), tax_on_time_rate NUMERIC(5,4),
  tax_arrears_cnt INT, tax_violation_cnt INT, high_severity_cnt INT,
  is_dishonesty BOOLEAN, is_execution BOOLEAN,
  vat_revenue NUMERIC(18,2), public_revenue NUMERIC(18,2), revenue_deviation NUMERIC(5,4),
  invoice_monthly_avg INT, social_trend VARCHAR(10),
  market_cap NUMERIC(18,2), pe_ratio NUMERIC(10,4), revenue_yoy NUMERIC(10,4), profit_yoy NUMERIC(10,4),
  roe NUMERIC(10,4), debt_ratio NUMERIC(10,4), z_score NUMERIC(10,4), z_score_level VARCHAR(10),
  updated_at TIMESTAMPTZ DEFAULT now());
INSERT INTO core_metrics VALUES ('ENT001','深圳明达科技有限公司','制造业','电子设备','广东','深圳','B',76.53,0.9825,3,0,1,FALSE,FALSE,37858371,39948153,0.0552,847,'增长',36082526324,13.7092,-0.0427,0.3423,0.0951,0.641,0.7147,'困境',NOW());
INSERT INTO core_metrics VALUES ('ENT002','上海恒信贸易集团','批发零售','贸易','上海','上海','A',99.94,0.8252,0,1,1,FALSE,FALSE,128956541,139543873,0.0821,1782,'增长',6630237698,29.2673,0.4609,-0.2332,0.101,0.5406,0.5355,'困境',NOW());
INSERT INTO core_metrics VALUES ('ENT003','北京智云信息技术有限公司','信息技术','软件服务','北京','北京','M',45.40,0.9471,2,1,2,FALSE,FALSE,1559887486,1731943075,0.1103,1111,'稳定',36611034953,14.4405,-0.0204,-0.2136,0.0767,0.7995,3.5304,'安全',NOW());
INSERT INTO core_metrics VALUES ('ENT004','广州华南制造股份有限公司','制造业','机械设备','广东','广州','B',76.57,0.9759,1,2,2,FALSE,FALSE,1977773881,1711169961,-0.1348,1941,'增长',32611174626,59.9638,0.1456,0.507,0.0552,0.157,3.4988,'安全',NOW());
INSERT INTO core_metrics VALUES ('ENT005','杭州绿源新能源科技','新能源','光伏','浙江','杭州','B',73.17,0.9642,1,2,2,FALSE,FALSE,3728970845,3203931750,-0.1408,832,'增长',17364659239,46.509,-0.0424,0.0477,0.0658,0.3756,2.2478,'灰色',NOW());
INSERT INTO core_metrics VALUES ('ENT006','成都天府物流有限公司','物流','供应链','四川','成都','B',79.89,0.8742,2,2,1,FALSE,FALSE,2426194919,2610100493,0.0758,821,'增长',32959517560,6.1755,0.1425,0.5334,-0.0454,0.4036,3.9798,'安全',NOW());
INSERT INTO core_metrics VALUES ('ENT007','武汉光谷生物医药','医药','生物制药','湖北','武汉','D',34.28,0.7874,2,1,1,FALSE,FALSE,1752397778,1691589575,-0.0347,1007,'稳定',4946277579,62.9675,-0.0375,0.4132,0.0745,0.3774,1.9662,'灰色',NOW());
INSERT INTO core_metrics VALUES ('ENT008','南京金陵建筑工程','建筑业','工程建设','江苏','南京','B',77.52,0.7784,1,0,0,FALSE,FALSE,4490352121,4154922817,-0.0747,1084,'稳定',10863688874,58.3411,0.305,0.2416,-0.0462,0.612,2.5068,'灰色',NOW());
INSERT INTO core_metrics VALUES ('ENT009','天津滨海港口服务','交通运输','港口','天津','天津','B',81.98,0.8804,3,2,0,FALSE,FALSE,4971868377,5295039821,0.0650,1522,'增长',10575933415,11.258,0.4043,-0.2463,0.0936,0.68,3.5998,'安全',NOW());
INSERT INTO core_metrics VALUES ('ENT010','重庆山城餐饮连锁','餐饮','连锁','重庆','重庆','M',52.29,0.8546,2,0,1,FALSE,FALSE,559290424,596427308,0.0664,966,'缩减',44473693941,58.1155,0.0913,0.0474,0.2213,0.7633,2.3776,'灰色',NOW());
CREATE TABLE IF NOT EXISTS legal_events (
  id SERIAL PRIMARY KEY, enterprise_id VARCHAR(64) NOT NULL, event_type VARCHAR(30) NOT NULL,
  severity CHAR(1) NOT NULL, amount_involved NUMERIC(18,2), event_date DATE,
  description VARCHAR(200), source VARCHAR(30), created_at TIMESTAMPTZ DEFAULT now());
INSERT INTO legal_events VALUES (1,'ENT001','civil_lawsuit','L',604458,'2024-12-10','合同纠纷被诉','企查查',NOW());
INSERT INTO legal_events VALUES (2,'ENT001','tax_arrears','L',112726,'2024-05-27','欠缴企业所得税','税务数据',NOW());
INSERT INTO legal_events VALUES (3,'ENT003','tax_violation','M',41267778,'2024-09-27','未按期申报增值税','税务数据',NOW());
INSERT INTO legal_events VALUES (4,'ENT005','civil_lawsuit','L',793221,'2024-03-02','合同纠纷被诉','企查查',NOW());
INSERT INTO legal_events VALUES (5,'ENT006','admin_penalty','M',1502338,'2026-04-05','市场监管局行政处罚','企查查',NOW());
INSERT INTO legal_events VALUES (6,'ENT006','civil_lawsuit','H',22824319,'2025-05-23','合同纠纷被诉','企查查',NOW());
INSERT INTO legal_events VALUES (7,'ENT006','tax_violation','L',728437,'2025-03-27','未按期申报增值税','税务数据',NOW());
INSERT INTO legal_events VALUES (8,'ENT009','tax_violation','L',770370,'2024-12-07','未按期申报增值税','税务数据',NOW());
INSERT INTO legal_events VALUES (9,'ENT009','civil_lawsuit','H',27602473,'2026-04-07','合同纠纷被诉','企查查',NOW());