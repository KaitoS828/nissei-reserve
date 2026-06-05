-- 人数別料金（1泊あたり）。NULL の場合は price_per_night（定額）にフォールバック。
-- キーは人数（文字列）、値はその人数のときの1泊料金。
alter table plan_prices add column if not exists guest_prices jsonb;

-- 素泊まりプラン（設定料金 ¥28,000）
update plan_prices set guest_prices =
  '{"1":20000,"2":20000,"3":28000,"4":28000,"5":31000,"6":34000}'::jsonb
  where plan_id = '186b58dd-5eff-418e-8752-8d5e057800c4';

-- プライベートサウナ付きプラン【KOBU SAUNA】（設定料金 ¥40,000）
update plan_prices set guest_prices =
  '{"1":26000,"2":26000,"3":38000,"4":40000,"5":46000,"6":52000}'::jsonb
  where plan_id = 'ea491355-749f-43e4-a2f3-e1d76779f651';
